# WhatsApp Setup

## Required Render environment variables

Set these on the backend service in Render:

```bash
GREEN_API_INSTANCE_ID=your_instance_id
GREEN_API_TOKEN=your_api_token
WHATSAPP_GROUP_NAME=Your WhatsApp Group Name
WHATSAPP_NOTIFICATIONS_ENABLED=true
```

Optional fallback:

```bash
WHATSAPP_GROUP_ID=120363012345678901@g.us
```

## Green API setup

1. Create a Green API account at `green-api.com`
2. Create an instance and save the `Instance ID` and `API Token`
3. Scan the QR code from the Green API dashboard using the WhatsApp number you want to connect
4. Wait until the instance shows as authorized

## Finding the WhatsApp group ID

After deploying the backend with the Green API credentials set, use the admin API endpoint below to look up a group ID by group name:

`POST /api/admin/whatsapp/find-group`

Request body:

```json
{
  "group_name": "Your WhatsApp Group Name"
}
```

If a matching group is found, you can either:

- set `WHATSAPP_GROUP_NAME` in the environment and let the backend resolve the correct group automatically
- or copy its `id` and set it as `WHATSAPP_GROUP_ID` as a direct fallback

Using `WHATSAPP_GROUP_NAME` is recommended when local and production point to different WhatsApp groups.

## Admin test and status endpoints

### Check WhatsApp status

`GET /api/admin/whatsapp/status`

Returns:
- whether WhatsApp is configured
- whether WhatsApp notifications are enabled
- current Green API instance state response
- resolved target group details or resolution error information

### Send a test message

`POST /api/admin/whatsapp/test`

Request body:

```json
{
  "message": "Test message from Glasgow Bengali FC"
}
```

## Implemented WhatsApp broadcast flows

The backend now sends WhatsApp group messages for:

- new match creation
- new practice session creation
- new forum post creation
- practice payment request activation

## Keep-alive behavior

A background scheduler now calls Green API every 30 minutes while the FastAPI service is running so the WhatsApp instance stays warm.

## Deployment steps

1. Push the latest code to GitHub
2. Redeploy the Render backend
3. Set the required Render environment variables
4. Call `GET /api/admin/whatsapp/status` to confirm configuration and authorization
5. If needed, call `POST /api/admin/whatsapp/find-group` to retrieve the group chat ID
6. Set `WHATSAPP_GROUP_NAME` for your production group, or set `WHATSAPP_GROUP_ID` as a fallback
7. Call `POST /api/admin/whatsapp/test` to verify messages reach the group
8. Create a new match, practice session, or forum post to verify live notifications
