declare global {
    interface XMLHttpRequest {
        _requestMethod: string;
        _requestURL: string | URL;
    }
}
type RequestInitRestricted = Omit<RequestInit, 'method' | 'body'> & {
    ignoreLocalhost?: boolean;
};
declare class OpErrorNotifier {
    private endpoint;
    private options;
    private originalXMLHttpRequestOpen;
    private originalXMLHttpRequestSend;
    private originalFetch;
    private ressourceElementNames;
    constructor(endpoint: URL | RequestInfo, options?: RequestInitRestricted);
    private sendNotification;
    private ressourceErrorHandler;
    init(): void;
}
export { OpErrorNotifier };
