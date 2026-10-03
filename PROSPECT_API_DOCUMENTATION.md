# Prospect Orchestration Engine - API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Webhook Integration](#webhook-integration)
5. [Payload Formats](#payload-formats)
6. [Error Handling](#error-handling)
7. [Integration Examples](#integration-examples)
8. [Testing](#testing)
9. [Security Best Practices](#security-best-practices)

---

## Overview

The Prospect Orchestration Engine (POE) provides a secure, scalable API for receiving leads from external sources. Leads are automatically processed through a pipeline that includes validation, enrichment, scoring, and routing.

### Key Features
- **Multiple Source Types**: API, Web Forms, CSV imports, Manual entry
- **Automatic Processing**: Leads flow through validation, enrichment, and scoring
- **Flexible Payloads**: Accept any JSON structure - we'll normalize it
- **Secure Authentication**: API key-based authentication for API sources
- **Webhook Support**: Direct webhook URLs for form integrations

### Base URL
```
Production: https://your-domain.com
Development: http://localhost:3000
```

---

## Authentication

### API Key Authentication

For `API` type sources, authentication is required using an API key.

#### Getting Your API Key

1. Log in to the Captain Prospect CRM Manager dashboard
2. Navigate to **Prospects → Sources**
3. Create a new source with type `API`
4. Copy the generated API key from the source details

#### Using the API Key

**Option 1: Header (Recommended)**
```http
POST /api/prospects/intake
X-API-Key: your-api-key-here
Content-Type: application/json
```

**Option 2: Authorization Header**
```http
POST /api/prospects/intake
Authorization: Bearer your-api-key-here
Content-Type: application/json
```

**Option 3: Request Body**
```json
{
  "sourceId": "cmkpcjp020007usfoe2rz6ppc",
  "apiKey": "your-api-key-here",
  "payload": { ... }
}
```

### Webhook Authentication

For `WEB_FORM` type sources, authentication is handled via the unique webhook URL. The `sourceId` is embedded in the URL.

**Optional Webhook Signature Verification:**

For enhanced security, you can enable webhook signature verification:
1. Generate a webhook secret (stored in source metadata)
2. Calculate HMAC SHA256 signature of the payload
3. Send signature in `X-Webhook-Signature` or `X-Signature` header

**Example (Node.js):**
```javascript
const crypto = require('crypto');
const secret = 'your-webhook-secret';
const payload = JSON.stringify({ firstName: 'John', email: 'john@example.com' });
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

// Send with header
headers: {
  'X-Webhook-Signature': signature
}
```

---

## API Endpoints

### 1. Intake Lead

Send a new lead to the Prospect Orchestration Engine.

**Endpoint:** `POST /api/prospects/intake`

#### Method 1: With Source ID in Body (API Sources)

```http
POST /api/prospects/intake
X-API-Key: your-api-key-here
Content-Type: application/json

{
  "sourceId": "cmkpcjp020007usfoe2rz6ppc",
  "payload": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+33612345678",
    "company": "Acme Corp",
    "title": "CEO",
    "customField1": "value1"
  }
}
```

#### Method 2: With Source ID in Query Parameter (Webhook Sources)

```http
POST /api/prospects/intake?sourceId=cmkpcjp020007usfoe2rz6ppc
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+33612345678",
  "company": "Acme Corp"
}
```

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "data": {
    "eventId": "cmkpcjp020008usfoe2rz6ppd",
    "profileId": "cmkpcjp020009usfoe2rz6ppe"
  }
}
```

**Error (400 Bad Request)**
```json
{
  "success": false,
  "error": "Source ID required"
}
```

**Error (401 Unauthorized)**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Error (404 Not Found)**
```json
{
  "success": false,
  "error": "Invalid source ID"
}
```

---

## Webhook Integration

### Setting Up a Webhook Source

1. **Create a Webhook Source**
   - Log in to Manager dashboard
   - Go to **Prospects → Sources → New**
   - Select type: `WEB_FORM`
   - Configure settings (default mission, auto-activate, etc.)
   - Save the source

2. **Copy the Webhook URL**
   - After creation, the webhook URL is displayed
   - Format: `https://your-domain.com/api/prospects/intake?sourceId=xxx`
   - This URL is unique to your source

3. **Configure Your Form/Platform**
   - Use the webhook URL as the form submission endpoint
   - Map your form fields to the payload structure (see below)

### Webhook Payload Structure

The webhook accepts any JSON structure. We automatically normalize common field names:

**Standard Fields (Auto-detected)**
- `firstName`, `first_name`, `firstname`, `First Name`
- `lastName`, `last_name`, `lastname`, `Last Name`
- `email`, `Email`, `EMAIL`, `e-mail`
- `phone`, `Phone`, `PHONE`, `telephone`, `tel`
- `company`, `companyName`, `company_name`, `Company`
- `title`, `Title`, `TITLE`, `jobTitle`, `job_title`, `position`

**Custom Fields**
Any additional fields are stored in `customFields` and preserved for later use.

### Example Webhook Payloads

**Minimal (Email only)**
```json
{
  "email": "lead@example.com"
}
```

**Standard Contact Form**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+33612345678",
  "company": "Tech Startup Inc",
  "title": "Marketing Director",
  "message": "Interested in your services",
  "source": "website-contact-form"
}
```

**Custom Form Fields**
```json
{
  "email": "lead@example.com",
  "first_name": "Bob",
  "last_name": "Johnson",
  "company_name": "Acme Corp",
  "job_title": "CTO",
  "budget": "50000",
  "timeline": "Q2 2024",
  "referral_source": "google-ads"
}
```

---

## Payload Formats

### Field Name Normalization

The system automatically recognizes multiple field name variations:

| Standard Field | Accepted Variations |
|---------------|---------------------|
| `firstName` | `first_name`, `firstname`, `First Name`, `FIRST_NAME` |
| `lastName` | `last_name`, `lastname`, `Last Name`, `LAST_NAME` |
| `email` | `Email`, `EMAIL`, `e-mail`, `email_address` |
| `phone` | `Phone`, `PHONE`, `telephone`, `tel`, `phone_number` |
| `company` | `companyName`, `company_name`, `Company`, `COMPANY`, `organization` |
| `title` | `Title`, `TITLE`, `jobTitle`, `job_title`, `position`, `job_position` |

### Recommended Payload Structure

For best results, use this structure:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+33612345678",
  "company": "Acme Corp",
  "title": "CEO",
  "website": "https://acme.com",
  "industry": "Technology",
  "companySize": "50-100",
  "customField1": "value1",
  "customField2": "value2"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | Success | Lead processed successfully |
| 400 | Bad Request | Invalid payload or missing required fields |
| 401 | Unauthorized | Invalid or missing API key |
| 404 | Not Found | Source ID not found |
| 500 | Internal Server Error | Server error during processing |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common Errors

**Missing Source ID**
```json
{
  "success": false,
  "error": "Source ID required (provide in query parameter ?sourceId=xxx or in request body)"
}
```

**Invalid API Key**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Source Not Active**
```json
{
  "success": false,
  "error": "Prospect source is not active"
}
```

**Empty Payload**
```json
{
  "success": false,
  "error": "Payload cannot be empty"
}
```

### Retry Logic

- **400/401/404 errors**: Do not retry - fix the request
- **500 errors**: Retry with exponential backoff (1s, 2s, 4s, 8s)
- **Network errors**: Retry up to 3 times

---

## Integration Examples

### 1. WordPress Contact Form (Contact Form 7)

Add this to your theme's `functions.php`:

```php
add_action('wpcf7_mail_sent', 'send_to_captainprospect_webhook');

function send_to_captainprospect_webhook($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    $posted_data = $submission->get_posted_data();
    
    $webhook_url = 'https://your-domain.com/api/prospects/intake?sourceId=YOUR_SOURCE_ID';
    
    $payload = array(
        'firstName' => $posted_data['first-name'],
        'lastName' => $posted_data['last-name'],
        'email' => $posted_data['email'],
        'phone' => $posted_data['phone'],
        'company' => $posted_data['company'],
        'message' => $posted_data['message']
    );
    
    wp_remote_post($webhook_url, array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($payload),
        'timeout' => 10
    ));
}
```

### 2. Zapier Integration

1. Create a new Zap
2. Choose your trigger (e.g., "New Form Submission")
3. Add action: "Webhooks by Zapier"
4. Choose "POST"
5. Enter webhook URL: `https://your-domain.com/api/prospects/intake?sourceId=YOUR_SOURCE_ID`
6. Set Payload Type: `json`
7. Map your form fields to the payload

**Example Zapier Payload:**
```json
{
  "firstName": "{{first_name}}",
  "lastName": "{{last_name}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "company": "{{company}}"
}
```

### 3. Make.com (Integromat) Integration

1. Create a new scenario
2. Add your trigger module (e.g., "Webhook")
3. Add HTTP module
4. Configure:
   - **Method**: POST
   - **URL**: `https://your-domain.com/api/prospects/intake?sourceId=YOUR_SOURCE_ID`
   - **Headers**: `Content-Type: application/json`
   - **Body**: Map your fields

### 4. Google Forms + Apps Script

```javascript
function onSubmit(e) {
  const formResponse = e.response;
  const itemResponses = formResponse.getItemResponses();
  
  const payload = {
    firstName: itemResponses[0].getResponse(),
    lastName: itemResponses[1].getResponse(),
    email: itemResponses[2].getResponse(),
    phone: itemResponses[3].getResponse(),
    company: itemResponses[4].getResponse()
  };
  
  const webhookUrl = 'https://your-domain.com/api/prospects/intake?sourceId=YOUR_SOURCE_ID';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch(webhookUrl, options);
}
```

### 5. Node.js/Express Integration

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/webhook/contact-form', async (req, res) => {
  try {
    const response = await axios.post(
      'https://your-domain.com/api/prospects/intake?sourceId=YOUR_SOURCE_ID',
      {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        company: req.body.company
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error sending to Captain Prospect CRM:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to process lead' });
  }
});

app.listen(3000);
```

### 6. Python/Flask Integration

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/webhook/contact-form', methods=['POST'])
def handle_contact_form():
    webhook_url = 'https://your-domain.com/api/prospects/intake?sourceId=YOUR_SOURCE_ID'
    
    payload = {
        'firstName': request.json.get('firstName'),
        'lastName': request.json.get('lastName'),
        'email': request.json.get('email'),
        'phone': request.json.get('phone'),
        'company': request.json.get('company')
    }
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response.raise_for_status()
        return jsonify({'success': True, 'data': response.json()})
    except requests.exceptions.RequestException as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)
```

### 7. cURL Examples

**API Source (with API key)**
```bash
curl -X POST https://your-domain.com/api/prospects/intake \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "sourceId": "cmkpcjp020007usfoe2rz6ppc",
    "payload": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+33612345678",
      "company": "Acme Corp"
    }
  }'
```

**Webhook Source (sourceId in URL)**
```bash
curl -X POST "https://your-domain.com/api/prospects/intake?sourceId=cmkpcjp020007usfoe2rz6ppc" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+33612345678",
    "company": "Tech Startup Inc"
  }'
```

---

## Testing

### Test Endpoint

You can test your source configuration using the test endpoint:

**Endpoint:** `POST /api/prospects/sources/{sourceId}/test-lead`

**Authentication:** Requires Manager role (use your session cookie)

**Example:**
```bash
curl -X POST https://your-domain.com/api/prospects/sources/cmkpcjp020007usfoe2rz6ppc/test-lead \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie"
```

This will send a test lead through your source and return the processing result.

### Sandbox Mode

Use the Sandbox page in the Manager dashboard:
1. Navigate to **Prospects → Sandbox**
2. Generate a test lead or customize the payload
3. Send it through the pipeline
4. View the processing steps and results

---

## Security Best Practices

### 1. API Key Security
- ✅ **DO**: Store API keys securely (environment variables, secret management)
- ✅ **DO**: Use HTTPS for all API calls
- ✅ **DO**: Rotate API keys periodically
- ❌ **DON'T**: Commit API keys to version control
- ❌ **DON'T**: Share API keys publicly or in client-side code

### 2. Webhook Security
- ✅ **DO**: Use HTTPS webhook URLs
- ✅ **DO**: Keep webhook URLs private (they contain the sourceId)
- ✅ **DO**: Monitor webhook usage for suspicious activity
- ❌ **DON'T**: Expose webhook URLs in client-side JavaScript

### 3. Payload Validation
- ✅ **DO**: Validate payload structure before sending
- ✅ **DO**: Sanitize user input (especially email, phone)
- ✅ **DO**: Set reasonable payload size limits (< 1MB)

### 4. Rate Limiting
- The API implements rate limiting to prevent abuse
- Recommended: Max 100 requests per minute per source
- If you exceed limits, you'll receive a 429 status code

### 5. Error Handling
- ✅ **DO**: Implement retry logic with exponential backoff
- ✅ **DO**: Log errors for debugging
- ✅ **DO**: Monitor API response times
- ❌ **DON'T**: Retry on 400/401/404 errors (fix the request instead)

---

## Support & Resources

### Getting Help
- **Documentation**: Check this file and `PROSPECT_ORCHESTRATION_SETUP.md`
- **Dashboard**: Use the Help Panel in the Manager dashboard
- **Support**: Contact your system administrator

### API Status
- Check API health: `GET /api/health` (if available)
- Monitor response times and error rates

### Changelog
- API versioning: Current version is v1
- Breaking changes will be communicated in advance

---

## Quick Reference

### Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/prospects/intake` | POST | API Key (for API sources) | Send a new lead |
| `/api/prospects/sources/{id}/test-lead` | POST | Session | Test source configuration |

### Required Headers

```
Content-Type: application/json
X-API-Key: your-api-key (for API sources)
```

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

**Last Updated:** 2024-01-15  
**API Version:** 1.0
