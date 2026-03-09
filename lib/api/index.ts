// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Basic API Client function with authentication support
export const apiClient = {
    get: async (endpoint: string, token?: string | null) => {
        // we need to attach the token in the request header
        const headers: HeadersInit = {}; // what is this HeadersInit object

        if(token){
            headers["Authorization"] = `Bearer ${token}` // anyone who bears this token is authorized to access this endpoint
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "GET",
            headers: headers
        })
        console.log(response)
        if(!response.ok) {
            throw new Error((`API Error: ${response.status}`))
        }

        return response.json()
    },
    
    post: async (endpoint: string, data: any, token?: string | null) => {
        const headers: HeadersInit = {
            "Content-Type": "application/json", // since it is a post request
        }; 

        if(token){
            headers["Authorization"] = `Bearer ${token}` // anyone who bears this token is authorized to access this endpoint
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(data) // because we need to send it as data
        })
        if(!response.ok) {
            throw new Error((`API Error: ${response.status}`))
        }

        return response.json()
    },
    
    put: async (endpoint: string, data: any, token?: string | null) => {
        const headers: HeadersInit = {
            "Content-Type": "application/json", // since it is a post request
        }; 

        if(token){
            headers["Authorization"] = `Bearer ${token}` // anyone who bears this token is authorized to access this endpoint
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(data) // becaise we need to send it as data
        })
        if(!response.ok) {
            throw new Error((`API Error: ${response.status}`))
        }

        return response.json()
    },
    
    delete: async (endpoint: string, token?: string | null) => {
        const headers: HeadersInit = {}; 

        if(token){
            headers["Authorization"] = `Bearer ${token}` // anyone who bears this token is authorized to access this endpoint
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "DELETE",
            headers: headers
        })
        if(!response.ok) {
            throw new Error((`API Error: ${response.status}`))
        }

        return response.json()
    },

    uploadToS3: async(url: string, file: File) => {
        const response = await fetch(url, {
            method: "PUT", 
            body: file,
            headers: {"Content-Type": file.type}
        });
        if (!response.ok){
            throw new Error(`S3 Upload Error: ${response.status}`)
        }
        return response; // S3 doesnt return JSON
    }

}