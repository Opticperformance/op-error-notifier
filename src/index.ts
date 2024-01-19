import { BrowserInfo, detect } from 'detect-browser';

// Override XMLHttpRequest open method
declare global {
  interface XMLHttpRequest {
    _requestMethod: string;
    _requestURL: string | URL;
  }
}

type RequestInitRestricted = Omit<RequestInit, 'method' | 'body'>;

class OpErrorNotifier {
  private endpoint: string;
  private options: RequestInitRestricted;

  // Save references to the original methods
  private originalXMLHttpRequestOpen = window.XMLHttpRequest.prototype.open;
  private originalXMLHttpRequestSend = window.XMLHttpRequest.prototype.send;
  private originalFetch = window.fetch.bind(window);

  constructor(endpoint: string, options: RequestInitRestricted = {}) {
    this.endpoint = endpoint;
    this.options = options;
  }

  // Helper function to log error information
  private sendNotification(
    target: URL | RequestInfo,
    method: string,
    responseCode: number,
    responseText: string
  ) {
    const { name, os, type, version } = detect() as BrowserInfo;

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

    // Send error details to the server
    this.originalFetch(this.endpoint, {
      ...this.options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorDetails),
    });
  }

  public init(): void {
    const self = this;

    window.XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL
    ) {
      // Store the method and URL for later use in the send method
      this._requestMethod = method;
      this._requestURL = url;

      // Define the expected type for the arguments object
      const args: [string, string | URL, boolean, string | undefined, string | undefined] = [method, url, false, undefined, undefined];
      
      return self.originalXMLHttpRequestOpen.apply(this, args);
    };

    // Override XMLHttpRequest send method
    window.XMLHttpRequest.prototype.send = function () {
      // Intercept the response
      this.addEventListener('load', function () {
        if (this.status >= 400) {
          // Log error details if the response code indicates an error
          self.sendNotification(
            this._requestURL,
            this._requestMethod,
            this.status,
            this.statusText
          );
        }
      });

      // Define the expected type for the arguments object
      const args: [Document | XMLHttpRequestBodyInit | null | undefined] = [arguments[0]];

      return self.originalXMLHttpRequestSend.apply(this, args);
    };

    // Override fetch function
    window.fetch = async function (url, options) {
      const method = (options && options.method) || 'GET';

      try {
        const response = await self.originalFetch(url, options);
        if (!response.ok) {
          // Log error details if the response code indicates an error
          self.sendNotification(
            url,
            method,
            response.status,
            response.statusText
          );
        }
        return response;
      } catch (error: any) {
        // Log error details for network errors
        self.sendNotification(url, method, 0, error.message);
        throw error;
      }
    };
  }
}

export default OpErrorNotifier;
