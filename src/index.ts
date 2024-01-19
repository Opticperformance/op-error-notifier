import { BrowserInfo, detect } from 'detect-browser';

// Override XMLHttpRequest open method
declare global {
  interface XMLHttpRequest {
    _requestMethod: string;
    _requestURL: string | URL;
  }
}

type RequestInitRestricted = Omit<RequestInit, 'method' | 'body'> & {
  ignoreLocalhost?: boolean;
};

type NotificationDetails = {
  target?: URL | RequestInfo,
  method?: string,
  statusCode?: number,
  statusText?: string,
  filename?: string,
  errorText?: string | Event,
  lineno?: number,
  colno?: number,
}

class OpErrorNotifier {
  private endpoint: URL | RequestInfo;
  private options: RequestInitRestricted;

  // Save references to the original methods
  private originalXMLHttpRequestOpen = window.XMLHttpRequest.prototype.open;
  private originalXMLHttpRequestSend = window.XMLHttpRequest.prototype.send;
  private originalFetch = window.fetch.bind(window);

  constructor(endpoint: URL | RequestInfo, options: RequestInitRestricted = {}) {
    this.endpoint = endpoint;
    this.options = options;
  }

  // Helper function to log error information
  private sendNotification(
    details: NotificationDetails
  ) {
    const { os, name: browserName, version: browserVersion } = detect() as BrowserInfo;

    // Send error details to the server
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

  public init(): void {
    if (this.options.ignoreLocalhost && window.location.hostname === 'localhost') {
      return;
    }

    const self = this;

    // Intercept JavaScript errors
    window.onerror = function (_, filename, lineno, colno, error) {
      self.sendNotification({
        errorText: error?.stack || error?.message || error?.toString(),
        filename,
        lineno,
        colno,
      });

      // Let the browser handle the error
      return false;
    };

    // Override XMLHttpRequest open method
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
            {
              target: this._requestURL,
              method: this._requestMethod,
              statusCode: this.status,
              statusText: this.statusText,
            }
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
          self.sendNotification({
            target: url,
            method,
            statusCode: response.status,
            statusText: response.statusText,
          });
        }
        return response;
      } catch (error: any) {
        // Log error details for network errors
        self.sendNotification(
          {
            target: url,
            method,
            statusCode: 0,
            errorText: error.message,
          }
          );
        throw error;
      }
    };
  }
}

export { OpErrorNotifier };
