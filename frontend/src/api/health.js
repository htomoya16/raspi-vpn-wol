import {request} from "./http";

export function fetchHealth() {
    return request("/api/health");
}