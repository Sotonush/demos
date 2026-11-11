(function (root) {
  "use strict";

  var NETWORK_ERROR = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз";
  var SERVER_ERROR = "Сервер временно недоступен, попробуйте чуть позже";
  var RETRIES = 2;
  var POLL_PAUSE_MS = 3000;
  var POSTER_MAX_BYTES = 1024 * 1024;
  var POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function LeadsError(message, status, fields) {
    this.name = "LeadsError";
    this.message = message;
    this.status = status || 0;
    this.fields = fields || null;
  }
  LeadsError.prototype = Object.create(Error.prototype);
  LeadsError.prototype.constructor = LeadsError;

  function trimSlash(url) {
    return String(url || "").replace(/\/+$/, "");
  }

  function requestId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID().replace(/-/g, "");
    }
    var out = "";
    for (var i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  }

  function readStored(key) {
    if (!key) return null;
    try { return root.localStorage ? root.localStorage.getItem(key) : null; } catch (e) { return null; }
  }

  function writeStored(key, value) {
    if (!key) return;
    try {
      if (!root.localStorage) return;
      if (value) root.localStorage.setItem(key, value); else root.localStorage.removeItem(key);
    } catch (e) {}
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function call(api, method, path, options) {
    options = options || {};
    var headers = { Accept: "application/json" };
    var body;
    if (options.form !== undefined) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    if (options.token) headers.Authorization = "Bearer " + options.token;
    return fetch(trimSlash(api) + path, {
      method: method,
      headers: headers,
      body: body,
      signal: options.signal,
      credentials: "omit",
      cache: "no-store"
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (response.ok) return data;
        var message = (data && data.error) || (response.status >= 500 ? SERVER_ERROR : "Ошибка запроса");
        throw new LeadsError(message, response.status, data && data.fields);
      });
    }, function (err) {
      if (err && err.name === "AbortError") throw err;
      throw new LeadsError(NETWORK_ERROR, 0);
    });
  }

  function withRetry(fn) {
    var attempt = 0;
    function run() {
      return fn().catch(function (err) {
        var retriable = err instanceof LeadsError && (err.status === 0 || err.status >= 500);
        if (!retriable || attempt >= RETRIES) throw err;
        attempt += 1;
        return sleep(800 * attempt).then(run);
      });
    }
    return run();
  }

  function create(config) {
    var api = trimSlash(config && config.api);
    if (!api) throw new LeadsError("Не указан адрес сервиса заявок", 0);
    return {
      newRequestId: requestId,
      submit: function (payload) {
        var body = Object.assign({}, payload);
        if (!body.client_request_id) body.client_request_id = requestId();
        return withRetry(function () { return call(api, "POST", "/api/orders", { body: body }); });
      },
      status: function (publicToken) {
        return call(api, "GET", "/api/orders/" + encodeURIComponent(publicToken));
      },
      videos: function () {
        return withRetry(function () { return call(api, "GET", "/api/videos"); }).then(function (data) {
          return (data && data.items) || [];
        });
      }
    };
  }

  function owner(config) {
    var api = trimSlash(config && config.api);
    if (!api) throw new LeadsError("Не указан адрес сервиса заявок", 0);
    var storageKey = config.persist ? "leads-owner-session:" + api : null;
    var onSessionExpired = config.onSessionExpired;
    var token = config.token || readStored(storageKey);
    function setToken(value) {
      token = value || null;
      writeStored(storageKey, token);
    }
    function owned(method, path, options) {
      options = options || {};
      if (!token) {
        var missing = new LeadsError("Войдите в кабинет", 401);
        if (onSessionExpired) onSessionExpired(missing);
        return Promise.reject(missing);
      }
      options.token = token;
      return call(api, method, path, options).catch(function (err) {
        if (err instanceof LeadsError && err.status === 401) {
          setToken(null);
          if (onSessionExpired) onSessionExpired(err);
        }
        throw err;
      });
    }
    function get(path, signal) { return owned("GET", path, { signal: signal }); }
    function query(params) {
      var parts = [];
      Object.keys(params || {}).forEach(function (key) {
        var value = params[key];
        if (value !== undefined && value !== null && value !== "") {
          parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
        }
      });
      return parts.length ? "?" + parts.join("&") : "";
    }
    function send(method, path, body) { return owned(method, path, { body: body }); }
    function videoPath(id) { return "/api/owner/videos/" + encodeURIComponent(Number(id)); }
    function uploadPoster(id, file) {
      var path = videoPath(id) + "/poster";
      if (typeof file === "string") {
        return send("POST", path, { data: file });
      }
      if (!file || typeof file.size !== "number") {
        return Promise.reject(new LeadsError("Выберите картинку для постера", 422, { file: "Выберите файл" }));
      }
      if (file.type && POSTER_TYPES.indexOf(file.type) === -1) {
        return Promise.reject(new LeadsError("Постер должен быть в формате JPG, PNG или WebP", 422, { file: "Постер должен быть в формате JPG, PNG или WebP" }));
      }
      if (file.size > POSTER_MAX_BYTES) {
        return Promise.reject(new LeadsError("Постер должен быть не больше 1 МБ", 413));
      }
      var form = new FormData();
      form.append("file", file, file.name || "poster");
      return owned("POST", path, { form: form });
    }
    var auth = {
      login: function (email, password) {
        return call(api, "POST", "/api/owner/auth/login", { body: { email: email, password: password } });
      },
      verify: function (challenge, code) {
        return call(api, "POST", "/api/owner/auth/verify", { body: { challenge: challenge, code: String(code || "").replace(/\s+/g, "") } })
          .then(function (data) {
            setToken(data.token);
            return data;
          });
      },
      me: function () { return get("/api/owner/auth/me"); },
      logout: function () {
        var finish = function () { setToken(null); };
        return send("POST", "/api/owner/auth/logout").then(function (data) { finish(); return data; }, function (err) { finish(); throw err; });
      },
      logoutAll: function () {
        return send("POST", "/api/owner/auth/logout-all").then(function (data) { setToken(null); return data; });
      },
      changePassword: function (current, next) {
        return send("POST", "/api/owner/auth/password", { current: current, "new": next });
      },
      regenerateRecovery: function (password, code) {
        return send("POST", "/api/owner/auth/2fa/regenerate-recovery", { password: password, code: String(code || "").replace(/\s+/g, "") })
          .then(function (data) { return data.recovery_codes; });
      },
      isLoggedIn: function () { return Boolean(token); },
      token: function () { return token; },
      setToken: setToken
    };
    return {
      auth: auth,
      videos: {
        list: function () { return get("/api/owner/videos").then(function (data) { return data.items; }); },
        create: function (payload) { return send("POST", "/api/owner/videos", payload); },
        update: function (id, patch) { return send("PATCH", videoPath(id), patch); },
        remove: function (id) { return owned("DELETE", videoPath(id)); },
        reorder: function (ids) {
          return send("PUT", "/api/owner/videos/order", { ids: ids.map(Number) }).then(function (data) { return data.items; });
        },
        uploadPoster: uploadPoster
      },
      list: function (params) { return get("/api/owner/orders" + query(params)); },
      get: function (number) { return get("/api/owner/orders/" + encodeURIComponent(Number(number))); },
      setStatus: function (number, status) {
        return send("PATCH", "/api/owner/orders/" + encodeURIComponent(Number(number)), { status: status });
      },
      setNote: function (number, note) {
        return send("PATCH", "/api/owner/orders/" + encodeURIComponent(Number(number)), { note: note });
      },
      summary: function () { return get("/api/owner/summary"); },
      watch: function (onEvents, onError) {
        var stopped = false;
        var controller = null;
        var last = null;
        function loop() {
          if (stopped) return;
          controller = typeof AbortController === "function" ? new AbortController() : null;
          var path = last === null ? "/api/owner/events" : "/api/owner/events" + query({ after: last, wait: 25 });
          get(path, controller && controller.signal).then(function (data) {
            var fresh = last !== null && data.events.length > 0;
            last = data.last_id;
            if (fresh) onEvents(data.events);
            loop();
          }, function (err) {
            if (stopped) return;
            if (onError) onError(err);
            if (err && err.status === 401) { stopped = true; return; }
            sleep(POLL_PAUSE_MS).then(loop);
          });
        }
        loop();
        return function stop() {
          stopped = true;
          if (controller) controller.abort();
        };
      }
    };
  }

  function whatsappLink(phone, text) {
    var digits = String(phone || "").replace(/\D/g, "");
    return "https://wa.me/" + digits + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  root.LeadsClient = { create: create, owner: owner, whatsappLink: whatsappLink, LeadsError: LeadsError };
})(typeof window !== "undefined" ? window : globalThis);
