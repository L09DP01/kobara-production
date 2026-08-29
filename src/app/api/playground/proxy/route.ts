import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for the API Playground.
 * Forwards requests to the target URL, bypassing browser CORS restrictions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method, headers: reqHeaders, body: reqBody } = body;

    if (!url || !method) {
      return NextResponse.json(
        { error: "Missing url or method" },
        { status: 400 }
      );
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers: reqHeaders || {},
    };

    if (reqBody && method !== "GET") {
      fetchOptions.body =
        typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
    }

    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    const elapsed = Date.now() - startTime;

    // Read response body
    const responseText = await response.text();

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
      time: elapsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 0,
        statusText: "Proxy Error",
        headers: {},
        body: JSON.stringify({ error: error.message || "Proxy request failed" }),
        time: 0,
      },
      { status: 200 } // Return 200 so the playground can read the error
    );
  }
}
