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

type HTMLResourceElement = HTMLScriptElement | HTMLLinkElement | HTMLMediaElement | HTMLImageElement | SVGImageElement;

class OpErrorNotifier {
  private endpoint: URL | RequestInfo;
  private options: RequestInitRestricted;

  // Save references to the original methods
  private originalXMLHttpRequestOpen = window.XMLHttpRequest.prototype.open;
  private originalXMLHttpRequestSend = window.XMLHttpRequest.prototype.send;
  private originalFetch = window.fetch.bind(window);
  private ressourceElementNames = ['script', 'link', 'img', 'audio', 'video', 'image'] as const;

  constructor(endpoint: URL | RequestInfo, options: RequestInitRestricted = {}) {
    this.endpoint = endpoint;
    this.options = { ignoreLocalhost: true, ...options };
    this.ressourceErrorHandler = this.ressourceErrorHandler.bind(this);
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

  private ressourceErrorHandler (event: Event): void {
    const target = event.target as HTMLResourceElement;
    const { src, href } = target as { src?: string, href?: string };

    this.sendNotification({
      target: src || href,
      errorText: 'Error: Failed to load resource'
    });
  }

  public init(): void {
    if (this.options.ignoreLocalhost && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return;
    }

    const self = this;

    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll(this.ressourceElementNames.join(',')).forEach((element) => {
        element.addEventListener('error', this.ressourceErrorHandler);
      });
    });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && this.ressourceElementNames.includes(node.nodeName.toLowerCase() as typeof this.ressourceElementNames[number])) {
              node.addEventListener('error', this.ressourceErrorHandler);
            }
          });
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Intercept JavaScript errors
    window.onerror = function () {
      const error = arguments[4] as Error;

      self.sendNotification({
        errorText: error?.stack || error?.message || error?.toString()
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
