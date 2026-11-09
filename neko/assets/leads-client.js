(function (root) {
  "use strict";

  var NETWORK_ERROR = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз";
  var SERVER_ERROR = "Сервер временно недоступен, попробуйте чуть позже";
  var RETRIES = 2;
  var POLL_PAUSE_MS = 3000;

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

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function call(api, method, path, options) {
    options = options || {};
    var headers = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.token) headers.Authorization = "Bearer " + options.token;
    return fetch(trimSlash(api) + path, {
      method: method,
      headers: headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
      }
    };
  }

  function owner(config) {
    var api = trimSlash(config && config.api);
    var token = config && config.token;
    if (!api || !token) throw new LeadsError("Нужны адрес сервиса и токен владельца", 0);
    function get(path, signal) { return call(api, "GET", path, { token: token, signal: signal }); }
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
    return {
      list: function (params) { return get("/api/owner/orders" + query(params)); },
      get: function (number) { return get("/api/owner/orders/" + encodeURIComponent(Number(number))); },
      setStatus: function (number, status) {
        return call(api, "PATCH", "/api/owner/orders/" + encodeURIComponent(Number(number)), { token: token, body: { status: status } });
      },
      setNote: function (number, note) {
        return call(api, "PATCH", "/api/owner/orders/" + encodeURIComponent(Number(number)), { token: token, body: { note: note } });
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
