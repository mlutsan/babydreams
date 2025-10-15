Project g-finance

# Description
This is a very lightweight web app that I want to use for family finance tracking. 

The app can be pinned to home screen on iphone and launch fast (but not full PWA at this moment)

Users will be able to quickly add their spends on the go: in shop, walking: just quickly add amount and description or upload a screenshot/photo of expenses. 
If screenshot/photo is uploaded: app will try to extract information from it and create an amount automatically. The recognition will be done with external AI system using API call.

All expenses are saved into google sheet: this is how this app differentiated from others. On first launch user will be asked to paste a google sheet link. When user provides a link: we redirect user to Google OAuth to get access to that sheet and on success save sheet link, auth data into local storage. 

In settings user also provides hiw name: it will be stored into expenses. App can be multi-user if multiple users share same google document.
User can change these settings later.

There is another page with history of expenses: on open data from google sheet is loaded and last 2 weeks are displayed. User can modify or delete an expense from there.

## Details

On launch user will see few fields:
- Amount - number
- Date (today by default), date type
- Category - selection from the list, categories are defined in google sheet doc in a sheet with the name "Settings" in "Categories" column.
- Description - freetext

below will be alternative: 

- Voice memo
- Photo / screenshot

Buttons "Save" \ "Add more" on the bottom.

### Expenses sheet structure
All Expenses are saved into sheet with the name "Expenses"
Structure:
Date | Amount | Category | Description | Author

### Saving

On save:
- If no voice memo or no photo attached: data is directly saved to google sheet into sheet with name "Expenses" with following order: 

- If voice or screenshot provided: it first sent to backend to process and extract data and after processing data is returned back to frontend and all fields are properly filled.
If during process it was identified multiple expenses (e.g. multiple categories): multiple invoices will be pre-filled and there is a quick navigation enabled between them (tabs or paging)
After click "Save" data is sent to google sheet and form reset.

### External AI API
I will use either OpenAI or Anthropic to process voice/images, we will use a model that can output a text or already structured information from voice. If models for image/voice processing cannot return structured info: we will feed the text into models that can turn text into structured data.

### Backend
Backend is present with recommended approach for TanStack project, web app will be hosted on cloudflare workers where backend functions are possible.
This will allow to not share any keys to frontend.

### Tech stack
TypeScript, Tailwind, Shadcn UI

### OAuth flow
It depends, what is easier flow: if we can reliably get tokens that are long-term on client side: then we go with front-end auth. If we need to manage tokens+refresh tokens: we implement flow on backend.

We do not want to share client secrets to frontend.