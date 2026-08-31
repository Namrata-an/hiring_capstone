// Test user credentials - these users are created by E2E test setup
export const testUsers = {
  hr: {
    email: 'e2e_hr@test.com',
    password: 'test123',
    role: 'hr_admin'
  },
  // Alternative: use existing test_hr user
  hrAlt: {
    email: 'test_hr@test.com',
    password: 'test123',
    role: 'hr_admin'
  },
  interviewer: {
    email: 'e2e_interviewer@test.com',
    password: 'test123',
    role: 'interviewer'
  }
};

// Sample candidate data for tests
export const sampleCandidates = {
  johnDoe: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    skills: ['Python', 'JavaScript', 'React'],
    experience: 5
  },
  janeSmith: {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    skills: ['Java', 'Spring Boot', 'AWS'],
    experience: 8
  }
};

// Sample job data
export const sampleJobs = {
  seniorEngineer: {
    title: 'Senior Software Engineer',
    department: 'Engineering',
    location: 'Remote',
    skills: ['Python', 'React', 'PostgreSQL']
  },
  productManager: {
    title: 'Product Manager',
    department: 'Product',
    location: 'San Francisco',
    skills: ['Product Strategy', 'Agile', 'Data Analysis']
  }
};

// Email template data
export const emailTemplates = {
  interviewConfirmation: {
    name: 'Interview Confirmation',
    subject: 'Interview Confirmation for {{position}} at {{company}}',
    body: `Dear {{candidate_name}},

We are pleased to confirm your interview for the {{position}} position.

Date: {{interview_date}}
Time: {{interview_time}}

Best regards,
{{interviewer_name}}`
  }
};
