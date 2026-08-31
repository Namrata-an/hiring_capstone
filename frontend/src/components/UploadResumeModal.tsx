import { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';
import { api } from '../apiService';
import type { Job } from '../apiService';

interface UploadResumeModalProps {
    jobs: Job[];
    onClose: () => void;
    onSuccess: () => void;
}

export const UploadResumeModal: React.FC<UploadResumeModalProps> = ({ jobs, onClose, onSuccess }) => {
    const [step, setStep] = useState<'job' | 'upload' | 'review'>('job');
    const [selectedJobId, setSelectedJobId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [resumeUrl, setResumeUrl] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionError, setExtractionError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Extracted data
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [experienceYears, setExperienceYears] = useState('');
    const [currentPosition, setCurrentPosition] = useState('');
    const [education, setEducation] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleJobSelect = () => {
        if (!selectedJobId) {
            alert('Please select a job position');
            return;
        }
        setStep('upload');
    };

    const handleFileSelect = async (selectedFile: File) => {
        if (!selectedFile.type.includes('pdf')) {
            alert('Please upload a PDF file');
            return;
        }

        setFile(selectedFile);
        setIsExtracting(true);
        setExtractionError('');

        try {
            // 1. Upload PDF directly to UploadThing CDN.
            const { url } = await api.uploadResume(selectedFile);
            setResumeUrl(url);

            // 2. Create a throwaway candidate just to run OCR text extraction
            //    against the URL (re-uses existing /candidates pipeline).
            const formData = new FormData();
            formData.append('name', 'temp_scan');
            formData.append('job_id', selectedJobId);
            formData.append('resume_url', url);
            const tempCandidate = await api.createCandidate(formData);

            if (tempCandidate.resume_text) {
                const extracted = await api.extractResumeDetails(tempCandidate.resume_text);
                setName(extracted.name || '');
                setEmail(extracted.email || '');
                setPhone(extracted.phone || '');
                setSkills(extracted.skills || []);
                setExperienceYears(extracted.experience_years || '');
                setCurrentPosition(extracted.current_position || '');
                setEducation(extracted.education || []);
                await api.deleteCandidate(tempCandidate.id);
                setStep('review');
            } else {
                setExtractionError('Could not extract text from PDF');
            }
        } catch (error) {
            console.error('Error extracting resume:', error);
            setExtractionError('Failed to process resume. Please try again.');
        }

        setIsExtracting(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('name', name || 'Unknown');
            formData.append('job_id', selectedJobId);
            if (email) formData.append('email', email);
            if (phone) formData.append('phone', phone);
            if (skills.length > 0) formData.append('skills', JSON.stringify(skills));
            if (experienceYears) formData.append('experience_years', experienceYears);
            if (currentPosition) formData.append('current_position', currentPosition);
            if (education.length > 0) formData.append('education', JSON.stringify(education));
            if (resumeUrl) formData.append('resume_url', resumeUrl);
            else if (file) formData.append('resume', file);

            await api.createCandidate(formData);
            onSuccess();
        } catch (error) {
            console.error('Error creating candidate:', error);
            alert('Failed to add candidate');
        }

        setIsSubmitting(false);
    };

    const selectedJob = jobs.find(j => j.id === selectedJobId);

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0a0a0a] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#e4e4e7]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-[#111111]">Add Candidate</h3>
                        {selectedJob && (
                            <p className="text-[#0070f3] text-sm mt-1">
                                Position: {selectedJob.title}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step 1: Job Selection */}
                {step === 'job' && (
                    <div className="space-y-4">
                        <p className="text-gray-400">Select the position this candidate is applying for:</p>
                        <div className="grid gap-3">
                            {jobs.filter(j => j.status === 'active').map(job => (
                                <div
                                    key={job.id}
                                    onClick={() => setSelectedJobId(job.id)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                        selectedJobId === job.id
                                            ? 'border-[#0070f3] bg-[#eff6ff]'
                                            : 'border-[#e4e4e7] bg-[#fafafa] hover:border-[#0070f3]/50'
                                    }`}
                                >
                                    <h4 className="text-[#111111] font-semibold">{job.title}</h4>
                                    {job.description && (
                                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                                            {job.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleJobSelect}
                            disabled={!selectedJobId}
                            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* Step 2: Upload with Drag & Drop */}
                {step === 'upload' && (
                    <div className="space-y-4">
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                                isDragging
                                    ? 'border-[#0070f3] bg-[#eff6ff]'
                                    : 'border-[#e4e4e7] hover:border-[#0070f3]/50 hover:bg-[#fafafa]'
                            }`}
                        >
                            {isExtracting ? (
                                <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-16 h-16 text-[#0070f3] animate-spin" />
                                    <p className="text-[#111111] font-semibold text-lg">Scanning Resume...</p>
                                    <p className="text-gray-400 text-sm">Extracting candidate information with AI</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <Upload className="w-16 h-16 text-gray-400" />
                                    <div>
                                        <p className="text-[#111111] font-semibold text-lg mb-1">
                                            Drop resume here or click to browse
                                        </p>
                                        <p className="text-gray-400 text-sm">PDF files only • AI extraction enabled</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileInputChange}
                            className="hidden"
                        />
                        {extractionError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {extractionError}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Review and Edit */}
                {step === 'review' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Resume scanned successfully! Review and edit the extracted information below.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Years of Experience</label>
                                <input
                                    type="text"
                                    value={experienceYears}
                                    onChange={e => setExperienceYears(e.target.value)}
                                    className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                                    placeholder="e.g., 3 or 5-7"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Current Position</label>
                            <input
                                type="text"
                                value={currentPosition}
                                onChange={e => setCurrentPosition(e.target.value)}
                                className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                                placeholder="e.g., Senior Software Engineer"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Skills</label>
                            <input
                                type="text"
                                value={skills.join(', ')}
                                onChange={e => setSkills(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                                className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                                placeholder="Python, JavaScript, React, etc."
                            />
                            {skills.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {skills.map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 rounded-full bg-[#eff6ff] text-[#0070f3] border border-[#0070f3]/30 text-xs"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {education.length > 0 && (
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Education</label>
                                {education.map((edu, index) => (
                                    <div key={index} className="p-3 bg-[#fafafa] rounded-lg border border-[#e4e4e7] mb-2">
                                        <p className="text-[#111111] font-medium">{edu.institution || 'Institution'}</p>
                                        <p className="text-gray-400 text-sm">
                                            {edu.degree} {edu.field && `in ${edu.field}`}
                                            {edu.years && ` • ${edu.years}`}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setStep('upload')}
                                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7]"
                            >
                                Upload Different Resume
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !name}
                                className="flex-1 btn-primary disabled:opacity-50"
                            >
                                {isSubmitting ? 'Adding...' : 'Add Candidate'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
