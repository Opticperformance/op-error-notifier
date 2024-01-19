"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpErrorNotifier = void 0;
const detect_browser_1 = require("detect-browser");
class OpErrorNotifier {
    endpoint;
    options;
    originalXMLHttpRequestOpen = window.XMLHttpRequest.prototype.open;
    originalXMLHttpRequestSend = window.XMLHttpRequest.prototype.send;
    originalFetch = window.fetch.bind(window);
    constructor(endpoint, options = {}) {
        this.endpoint = endpoint;
        this.options = options;
    }
    sendNotification(details) {
        const { os, name: browserName, version: browserVersion } = (0, detect_browser_1.detect)();
        this.originalFetch(this.endpoint, {
            ...this.options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...details,
                origin: window.location.href,
                browserName,
                browserVersion,
                os,
                timestamp: new Date().toISOString(),
            }),
        });
    }
    init() {
        const self = this;
        window.onerror = function (message, filename, lineno, colno) {
            self.sendNotification({
                errorText: message,
                filename,
                lineno,
                colno,
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
        window.fetch = async function (url, options) {
            const method = (options && options.method) || 'GET';
            try {
                const response = await self.originalFetch(url, options);
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
        };
    }
}
exports.OpErrorNotifier = OpErrorNotifier;
