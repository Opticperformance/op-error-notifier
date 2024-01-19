declare global {
    interface XMLHttpRequest {
        _requestMethod: string;
        _requestURL: string | URL;
    }
}
type RequestInitRestricted = Omit<RequestInit, 'method' | 'body'>;
declare class OpErrorNotifier {
    private endpoint;
    private options;
    private originalXMLHttpRequestOpen;
    private originalXMLHttpRequestSend;
    private originalFetch;
    constructor(endpoint: URL | RequestInfo, options?: RequestInitRestricted);
    private sendNotification;
    init(): void;
}
export default OpErrorNotifier;
