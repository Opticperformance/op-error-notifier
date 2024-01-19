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
    sendNotification(target, method, responseCode, responseText) {
        const { name, os, type, version } = (0, detect_browser_1.detect)();
        const errorDetails = {
            origin: window.location.href,
            target,
            method,
            responseCode,
            responseText,
            browserName: name,
            browserVersion: version,
            browserOS: os,
            browserType: type,
            timestamp: new Date().toISOString(),
        };
        this.originalFetch(this.endpoint, {
            ...this.options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(errorDetails),
        });
    }
    init() {
        const self = this;
        window.XMLHttpRequest.prototype.open = function (method, url) {
            this._requestMethod = method;
            this._requestURL = url;
            const args = [method, url, false, undefined, undefined];
            return self.originalXMLHttpRequestOpen.apply(this, args);
        };
        window.XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
                if (this.status >= 400) {
                    self.sendNotification(this._requestURL, this._requestMethod, this.status, this.statusText);
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
                    self.sendNotification(url, method, response.status, response.statusText);
                }
                return response;
            }
            catch (error) {
                self.sendNotification(url, method, 0, error.message);
                throw error;
            }
        };
    }
}
exports.OpErrorNotifier = OpErrorNotifier;
