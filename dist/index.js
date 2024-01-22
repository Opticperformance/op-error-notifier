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
        this.windowExists = typeof window !== 'undefined';
        this.XMLHttpRequestExists = typeof XMLHttpRequest !== 'undefined';
        this.fetchExists = typeof fetch !== 'undefined';
        this.originalXMLHttpRequestOpen = this.XMLHttpRequestExists ? XMLHttpRequest.prototype.open : undefined;
        this.originalXMLHttpRequestSend = this.XMLHttpRequestExists ? XMLHttpRequest.prototype.send : undefined;
        this.originalFetch = this.fetchExists ? (this.windowExists ? fetch : fetch.bind(window)) : undefined;
        this.endpoint = endpoint;
        this.options = Object.assign({ ignoreLocalhost: true }, options);
    }
    sendNotification(details) {
        var _a;
        const { os, name: browserName, version: browserVersion } = (0, detect_browser_1.detect)();
        (_a = this.originalFetch) === null || _a === void 0 ? void 0 : _a.call(this, this.endpoint, Object.assign(Object.assign({}, this.options), { method: 'POST', headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify(Object.assign(Object.assign({}, details), { origin: window.location.href, browserName,
                browserVersion,
                os, timestamp: new Date().toISOString() })) }));
    }
    init() {
        if (this.options.ignoreLocalhost && ['localhost', '127.0.0.1'].includes(this.windowExists ? window.location.hostname : require('os').hostname())) {
            return;
        }
        const self = this;
        if (this.windowExists) {
            window.onerror = function () {
                const error = arguments[4];
                self.sendNotification({
                    errorText: (error === null || error === void 0 ? void 0 : error.stack) || (error === null || error === void 0 ? void 0 : error.message) || (error === null || error === void 0 ? void 0 : error.toString())
                });
                return false;
            };
        }
        if (this.XMLHttpRequestExists) {
            XMLHttpRequest.prototype.open = function (method, url) {
                var _a;
                this._requestMethod = method;
                this._requestURL = url;
                const args = [method, url, false, undefined, undefined];
                return (_a = self.originalXMLHttpRequestOpen) === null || _a === void 0 ? void 0 : _a.apply(this, args);
            };
            XMLHttpRequest.prototype.send = function () {
                var _a;
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
                return (_a = self.originalXMLHttpRequestSend) === null || _a === void 0 ? void 0 : _a.apply(this, args);
            };
        }
        if (this.fetchExists) {
            global.fetch = function (url, options) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    const method = (options && options.method) || 'GET';
                    try {
                        const response = yield ((_a = self.originalFetch) === null || _a === void 0 ? void 0 : _a.call(self, url.toString(), options));
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
}
exports.OpErrorNotifier = OpErrorNotifier;
