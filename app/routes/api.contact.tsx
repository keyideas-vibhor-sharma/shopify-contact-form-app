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

    const firstNameStr = (firstName || "").toString().trim();
    const lastNameStr = (lastName || "").toString().trim();
    const emailStr = (email || "").toString().trim().toLowerCase();
    const mobileStr = (mobile || "").toString().trim();

    // 1. Validate required fields
    if (!firstNameStr || !lastNameStr || !emailStr || !mobileStr) {
      return json(
        { error: "All fields (first name, last name, email, mobile) are required." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Validate First Name and Last Name: No numbers allowed
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (/\d/.test(firstNameStr) || !nameRegex.test(firstNameStr)) {
      return json(
        { error: "Numbers and invalid characters are not allowed in First Name." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (firstNameStr.length < 2) {
      return json(
        { error: "First Name must be at least 2 characters long." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (/\d/.test(lastNameStr) || !nameRegex.test(lastNameStr)) {
      return json(
        { error: "Numbers and invalid characters are not allowed in Last Name." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (lastNameStr.length < 2) {
      return json(
        { error: "Last Name must be at least 2 characters long." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Proper format of email (valid address with minimum 2-character TLD)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailStr)) {
      return json(
        { error: "Invalid email address format. Please enter a valid email address (e.g., name@example.com)." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Validate Mobile: No alphabets allowed & appropriate length check (10 to 15 digits)
    if (/[a-zA-Z]/.test(mobileStr)) {
      return json(
        { error: "Alphabets are not allowed in the phone number field." },
        { status: 400, headers: corsHeaders }
      );
    }

    const phoneAllowedCharsRegex = /^[\+]?[0-9\s\-\(\)]+$/;
    if (!phoneAllowedCharsRegex.test(mobileStr)) {
      return json(
        { error: "Phone number contains invalid characters. Use only digits, +, -, or ()." },
        { status: 400, headers: corsHeaders }
      );
    }

    const digitsOnly = mobileStr.replace(/\D/g, "");
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return json(
        { error: `Phone number must be between 10 and 15 digits. Provided number has ${digitsOnly.length} digits.` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Save record to SQLite database via Prisma
    const submission = await db.contactSubmission.create({
      data: {
        shop: finalShop,
        firstName: firstNameStr,
        lastName: lastNameStr,
        email: emailStr,
        mobile: mobileStr,
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
