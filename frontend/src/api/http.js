export async function request(path, options = {}) {
    const res = await fetch(path, options);
    const data = await res.json();
    
    if(!res.ok){
        throw new Error(data.detail ?? "HTTP ${res.status}");
    }
    return data;
}