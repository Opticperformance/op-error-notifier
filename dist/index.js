"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpErrorNotifier = void 0;
const detect_browser_1 = require("detect-browser");
class OpErrorNotifier {
    constructor(endpoint, options = {}) {
        this.originalXMLHttpRequestOpen = window.XMLHttpRequest.prototype.open;
        this.originalXMLHttpRequestSend = window.XMLHttpRequest.prototype.send;
        this.originalFetch = window.fetch.bind(window);
        this.endpoint = endpoint;
        this.options = Object.assign({ ignoreLocalhost: true }, options);
    }
    sendNotification(details) {
        const { os, name: browserName, version: browserVersion } = (0, detect_browser_1.detect)();
        this.originalFetch(this.endpoint, Object.assign(Object.assign({}, this.options), { method: 'POST', headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify(Object.assign(Object.assign({}, details), { origin: window.location.href, browserName,
                browserVersion,
                os, timestamp: new Date().toISOString() })) }));
    }
    init() {
        if (this.options.ignoreLocalhost && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            return;
        }
        const self = this;
        window.onerror = function () {
            const error = arguments[4];
            self.sendNotification({
                errorText: (error === null || error === void 0 ? void 0 : error.stack) || (error === null || error === void 0 ? void 0 : error.message) || (error === null || error === void 0 ? void 0 : error.toString())
            });
            return false;
        };
        window.XMLHttpRequest.prototype.open = function (method, url) {
            this._requestMethod = method;
            this._requestURL = url;
            const args = [method, url, false, undefined, undefined];
            return self.originalXMLHttpRequestOpen.apply(this, args);
        };
        window.XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
                if (this.status >= 400) {
                    self.sendNotification({
                        target: this._requestURL,
                        method: this._requestMethod,
                        statusCode: this.status,
                        statusText: this.statusText,
                    });
                }
            });
            const args = [arguments[0]];
            return self.originalXMLHttpRequestSend.apply(this, args);
        };
        window.fetch = function (url, options) {
            return __awaiter(this, void 0, void 0, function* () {
                const method = (options && options.method) || 'GET';
                try {
                    const response = yield self.originalFetch(url, options);
                    if (!response.ok) {
                        self.sendNotification({
                            target: url,
                            method,
                            statusCode: response.status,
                            statusText: response.statusText,
                        });
                    }
                    return response;
                }
                catch (error) {
                    self.sendNotification({
                        target: url,
                        method,
                        statusCode: 0,
                        errorText: error.message,
                    });
                    throw error;
                }
            });
        };
    }
}
exports.OpErrorNotifier = OpErrorNotifier;
