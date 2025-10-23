import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Brain } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import ProgressBar from '../components/ProgressBar';
import Toast from '../components/Toast';

const UploadPage = () => {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState('');
  const [jdInputType, setJdInputType] = useState('file');
  const [resumeError, setResumeError] = useState(null);
  const [jdError, setJdError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Change this URL to your backend endpoint
  const UPLOAD_ENDPOINT = 'http://localhost:8000/upload';

  const handleResumeSelect = (file, error) => {
    setResumeFile(file);
    setResumeError(error);
  };

  const handleJdSelect = (file, error) => {
    setJdFile(file);
    setJdError(error);
  };

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  const closeToast = () => {
    setToast(null);
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    return interval;
  };

  const handleSubmit = async () => {
    // Check if we have required files/text - only resume is required
    if (!resumeFile || resumeError || jdError) return;

    // Set loading state and start progress simulation
    setIsUploading(true);
    setResponseMessage('');
    const progressInterval = simulateProgress();

    try {
      // Create FormData to send files and text to backend
      const formData = new FormData();
      formData.append('resumeFile', resumeFile);  // Always include resume file
      
      // Add JD file if user uploaded one
      if (jdFile) {
        formData.append('jdFile', jdFile);
      }
      
      // Add JD text if user pasted text
      if (jdText.trim()) {
        formData.append('jdText', jdText.trim());
      }

      // Send POST request to FastAPI backend
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,  // Send form data with files
      });

      // Stop progress simulation
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        // Parse successful response from backend
        const result = await response.json();
        
        // Show success message and file paths
        showToast('success', '✅ Extraction successful!');
        setResponseMessage(`${result.message}\n\nFiles created:\n${Object.entries(result.file_paths || {}).map(([key, path]) => `• ${key}: ${path}`).join('\n')}`);
        
        // Show success state with interview button
        setUploadSuccess(true);
        setSessionId(result.session_id);
      } else {
        // Handle error response from backend
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      // Handle any errors during upload
      clearInterval(progressInterval);
      setUploadProgress(0);
      showToast('error', '❌ Extraction failed');
      setResponseMessage(`Error: ${error.message}`);
    } finally {
      // Always reset loading state
      setIsUploading(false);
    }
  };

  const canSubmit = resumeFile && !resumeError && !jdError && !isUploading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Upload Your Resume & Job Description
          </h1>
          <p className="text-lg text-gray-600">
            Start your AI interview analysis journey
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
          <div className="space-y-6">
            {/* Resume Upload */}
            <FileUpload
              label="Resume"
              accept=".pdf,.docx"
              maxSize={5 * 1024 * 1024}
              onFileSelect={handleResumeSelect}
              selectedFile={resumeFile}
              error={resumeError}
            />

            {/* Job Description Input */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Job Description
              </label>
              
              <div className="flex space-x-4 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setJdInputType('file');
                    setJdText('');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    jdInputType === 'file'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJdInputType('text');
                    setJdFile(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    jdInputType === 'text'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Paste Text
                </button>
              </div>

              {jdInputType === 'file' ? (
                <FileUpload
                  label=""
                  accept=".pdf,.docx"
                  maxSize={5 * 1024 * 1024}
                  onFileSelect={handleJdSelect}
                  selectedFile={jdFile}
                  error={jdError}
                />
              ) : (
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Uploading and processing files...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <ProgressBar progress={uploadProgress} />
              </div>
            )}

            {/* Submit Button or Interview Button */}
            {!uploadSuccess ? (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`
                  w-full py-3 px-4 rounded-lg font-medium text-white
                  transition-all duration-200 ease-in-out
                  ${canSubmit
                    ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
                    : 'bg-gray-300 cursor-not-allowed'
                  }
                  ${isUploading ? 'animate-pulse' : ''}
                `}
              >
                {isUploading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Start AI Analysis'
                )}
              </button>
            ) : (
              <button
                onClick={() => navigate('/interview', { state: { sessionId } })}
                className="w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-lg transition-all duration-200 ease-in-out hover:shadow-lg transform hover:-translate-y-0.5"
              >
                🎤 Start AI Interview with Voice
              </button>
            )}

            {/* Response Message Display */}
            {responseMessage && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Backend Response:</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">{responseMessage}</pre>
              </div>
            )}

            {/* Helper Text */}
            <div className="text-center">
              {!uploadSuccess ? (
                <p className="text-sm text-gray-500">
                  Resume file is required. Job description is optional.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-green-600">
                    ✅ Files processed successfully!
                  </p>
                  <p className="text-sm text-gray-600">
                    Ready to start your AI-powered speech interview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400">
            Your files are processed securely and deleted after analysis
          </p>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={closeToast}
        />
      )}
    </div>
  );
};

export default UploadPage;