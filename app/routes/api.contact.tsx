import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

// CORS headers to allow storefront requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS preflight requests from browser fetch
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return json({ message: "API endpoint active. Use POST to submit contact data." }, { headers: corsHeaders });
}

// Handle POST submissions from storefront contact form
export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    let body: any = {};
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = {
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        mobile: formData.get("mobile"),
        shop: formData.get("shop"),
      };
    }
    const { firstName, lastName, email, mobile, shop } = body;
    const url = new URL(request.url);
    const shopFromQuery = url.searchParams.get("shop");
    const finalShop = (shop || shopFromQuery || "storefront").toString().trim();

    // Validate required fields
    if (!firstName || !lastName || !email || !mobile) {
      return json(
        { error: "All fields (first name, last name, email, mobile) are required." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json(
        { error: "Invalid email address format." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Save record to SQLite database via Prisma
    const submission = await db.contactSubmission.create({
      data: {
        shop: finalShop,
        firstName: firstName.toString().trim(),
        lastName: lastName.toString().trim(),
        email: email.toString().trim().toLowerCase(),
        mobile: mobile.toString().trim(),
      },
    });

    return json(
      {
        success: true,
        message: "Form submitted successfully!",
        submission: {
          id: submission.id,
          firstName: submission.firstName,
          lastName: submission.lastName,
          email: submission.email,
          mobile: submission.mobile,
          createdAt: submission.createdAt,
        },
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Error processing form submission:", error);
    return json(
      { error: "Internal server error occurred while saving submission." },
      { status: 500, headers: corsHeaders }
    );
  }
}
