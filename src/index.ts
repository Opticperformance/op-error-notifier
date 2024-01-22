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
  errorText?: string | Event,
}

class OpErrorNotifier {
  private endpoint: URL | RequestInfo;
  private options: RequestInitRestricted;
  private windowExists = typeof window !== 'undefined';
  private XMLHttpRequestExists = typeof XMLHttpRequest !== 'undefined';
  private fetchExists = typeof fetch !== 'undefined';

  // Save references to the original methods
  private originalXMLHttpRequestOpen = this.XMLHttpRequestExists ? XMLHttpRequest.prototype.open : undefined;
  private originalXMLHttpRequestSend = this.XMLHttpRequestExists ? XMLHttpRequest.prototype.send : undefined;
  private originalFetch =  this.fetchExists ? (this.windowExists ? fetch : fetch.bind(window)) : undefined;

  constructor(endpoint: URL | RequestInfo, options: RequestInitRestricted = {}) {
    this.endpoint = endpoint;
    this.options = { ignoreLocalhost: true, ...options };
  }

  // Helper function to log error information
  private sendNotification(
    details: NotificationDetails
  ) {
    const { os, name: browserName, version: browserVersion } = detect() as BrowserInfo;

    // Send error details to the server
    this.originalFetch?.(this.endpoint, {
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
    if (this.options.ignoreLocalhost && ['localhost', '127.0.0.1'].includes(this.windowExists ? window.location.hostname : require('os').hostname())) {
      return;
    }

    const self = this;

    // Intercept JavaScript errors
    if (this.windowExists) {
      window.onerror = function () {
        const error = arguments[4] as Error;
  
        self.sendNotification({
          errorText: error?.stack || error?.message || error?.toString()
        });
  
        // Let the browser handle the error
        return false;
      };
    }

    if (this.XMLHttpRequestExists) {
      // Override XMLHttpRequest open method
      XMLHttpRequest.prototype.open = function (
        method: string,
        url: string | URL
      ) {
        // Store the method and URL for later use in the send method
        this._requestMethod = method;
        this._requestURL = url;
  
        // Define the expected type for the arguments object
        const args: [string, string | URL, boolean, string | undefined, string | undefined] = [method, url, false, undefined, undefined];
        
        return (self.originalXMLHttpRequestOpen as (this: XMLHttpRequest, args_0: string, args_1: string | URL, args_2: boolean, args_3: string | undefined, args_4: string | undefined) => void)?.apply(this, args);
      };

      // Override XMLHttpRequest send method
      XMLHttpRequest.prototype.send = function () {
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

        return (self.originalXMLHttpRequestSend as (this: XMLHttpRequest, args_0: Document | XMLHttpRequestBodyInit | null | undefined) => void)?.apply(this, args);
    };
    }

    // Override fetch function
    if (this.fetchExists) {
      global.fetch = async function (url, options) {
        const method = (options && options.method) || 'GET';
  
        try {
          const response = await (self.originalFetch as (url: RequestInfo, options?: RequestInit) => Promise<Response>)?.(url.toString(), options);
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
}

export { OpErrorNotifier };
