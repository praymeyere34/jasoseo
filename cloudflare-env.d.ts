declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    SOLAPI_API_KEY?: string;
    SOLAPI_API_SECRET?: string;
    SOLAPI_SENDER_NUMBER?: string;
  }
}
