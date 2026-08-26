import os
import json
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Query, Body, Header
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

import database

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database on startup
    database.init_db()
    print("Database initialized successfully.")
    yield

app = FastAPI(title="SMS Forwarder Center", lifespan=lifespan)

# Helper function to pick values from aliases
def pick_field(data: Dict[str, Any], aliases: list, default: str = "") -> str:
    for key in aliases:
        val = data.get(key)
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return default

@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


# Unified SMS Receive Handler (Supports both modern route and PHP compatibility route)
@app.post("/api/sms/receive")
@app.post("/api_sms_receive.php")
async def receive_sms(request: Request, token: Optional[str] = Query(None)):
    content_type = request.headers.get("content-type", "").lower()
    data: Dict[str, Any] = {}
    
    # 1. Parse incoming payload (JSON or Form-urlencoded)
    if "application/json" in content_type:
        try:
            data = await request.json()
        except Exception:
            data = {}
    else:
        try:
            form_data = await request.form()
            data = dict(form_data)
        except Exception:
            data = {}

    # 2. Extract Token (Priority: Query param -> Body -> Header)
    req_token = token or data.get("token") or request.headers.get("x-token")
    if not req_token:
        return JSONResponse(status_code=401, content={"success": False, "error": "Missing token"})

    # 3. Validate Token
    if not database.validate_token(req_token):
        return JSONResponse(status_code=403, content={"success": False, "error": "Invalid or disabled token"})

    # 4. Extract SMS fields with aliases
    phone = pick_field(data, ["phone", "sender", "from", "mobile", "msisdn"])
    content = pick_field(data, ["content", "text", "message", "body", "msg"])
    time_val = pick_field(data, ["time", "timestamp", "receive_time", "received_at", "date", "datetime"])
    device = pick_field(data, ["device", "sim", "sim_slot", "sim_name", "device_name"])

    if not phone or not content:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Missing required fields (phone and content are required)",
                "received_data": data
            }
        )

    # 5. Save to database
    sms_id = database.save_sms(phone=phone, content=content, time_val=time_val, device=device)
    print(f"[{device or 'Default'}] Received SMS from {phone}: {content[:30]}... (ID: {sms_id})")

    return {"success": True, "id": sms_id}

@app.get("/api/sms/list")
async def list_sms(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    device: str = Query(""),
    phone: str = Query(""),
    query: str = Query("")
):
    result = database.get_sms_list(page=page, per_page=per_page, device=device, phone=phone, query=query)
    return result

@app.get("/api/sms/devices")
async def list_devices():
    return database.get_devices()

@app.delete("/api/sms/clear")
async def clear_sms():
    deleted_count = database.clear_all_sms()
    return {"success": True, "deleted": deleted_count}

# Token Management APIs
class TokenCreate(BaseModel):
    token: str
    name: str = ""

@app.get("/api/tokens")
async def get_tokens():
    return database.get_tokens()

@app.post("/api/tokens")
async def create_token(body: TokenCreate):
    ok = database.add_token(token=body.token, name=body.name)
    if not ok:
        return JSONResponse(status_code=400, content={"success": False, "error": "Token already exists or invalid"})
    return {"success": True}

@app.post("/api/tokens/{token_id}/toggle")
async def toggle_token_status(token_id: int):
    database.toggle_token(token_id)
    return {"success": True}

@app.delete("/api/tokens/{token_id}")
async def delete_token(token_id: int):
    database.delete_token(token_id)
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    # Default listen on 0.0.0.0:8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
