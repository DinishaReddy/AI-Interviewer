# AI Interview Coach

A modern, responsive React application for uploading resumes and job descriptions to start AI-powered interview analysis.

## Features

- 📁 Drag & drop file upload with validation
- 📱 Mobile-first responsive design
- 🎨 Modern UI with Tailwind CSS
- 📊 Upload progress tracking
- 🔔 Toast notifications for success/error states
- ✅ File validation (PDF/DOCX, max 5MB)
- 🎯 Professional, minimal design

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Configuration

### Changing the Upload Endpoint

To change the backend API endpoint, modify the `UPLOAD_ENDPOINT` constant in `src/pages/UploadPage.jsx`:

```javascript
// Change this URL to your backend endpoint
const UPLOAD_ENDPOINT = 'http://localhost:8000/upload';
```

### File Upload Requirements

- **Accepted formats**: PDF, DOCX
- **Maximum file size**: 5MB per file
- **Required files**: Both resume and job description must be uploaded
- **Field names**: `resumeFile` and `jdFile` (for backend integration)

## Project Structure

```
src/
├── components/
│   ├── FileUpload.jsx      # Reusable drag & drop file upload
│   ├── ProgressBar.jsx     # Upload progress indicator
│   └── Toast.jsx           # Success/error notifications
├── pages/
│   └── UploadPage.jsx      # Main upload interface
├── App.jsx                 # Main app component with routing
├── main.jsx               # React entry point
└── index.css              # Global styles with Tailwind
```

## API Integration

The upload form sends a POST request to the configured endpoint with:
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Fields**: 
  - `resumeFile`: The uploaded resume file
  - `jdFile`: The uploaded job description file

Expected response format:
```json
{
  "success": true,
  "message": "Files processed successfully"
}
```

## Customization

### Styling
- Built with Tailwind CSS for easy customization
- Responsive design works on mobile, tablet, and desktop
- Professional blue/indigo color scheme

### File Validation
- Modify accepted file types in `FileUpload.jsx`
- Adjust maximum file size limits as needed
- Add additional validation rules in the `validateFile` function

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Modern icon library
- **React Router** - Client-side routing