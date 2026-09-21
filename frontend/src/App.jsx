import { useEffect, useState } from 'react'

import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut,
} from 'aws-amplify/auth'

const API_URL =
  'https://156wo9pssc.execute-api.us-east-1.amazonaws.com'

async function getAccessToken() {
  const session = await fetchAuthSession()

  const token =
    session.tokens?.accessToken?.toString()

  if (!token) {
    throw new Error('No Cognito access token found')
  }

  return token
}

function getStatusMessage(status) {
  if (status === 'TEXTRACT_SUBMITTED') {
    return 'Reading your document...'
  }

  if (status === 'TEXTRACT_DONE') {
    return 'Creating vocabulary exercises...'
  }

  if (status === 'EXERCISES_DONE') {
    return 'Exercises ready ✅'
  }

  return 'Processing your document...'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const [docId, setDocId] = useState('')
  const [processingMessage, setProcessingMessage] = useState('')

  const [mcqExercises, setMcqExercises] = useState([])
  const [fillExercises, setFillExercises] = useState([])
  const [mcqAnswers, setMcqAnswers] = useState({})
  const [mcqFeedback, setMcqFeedback] = useState({})

  const [fillAnswers, setFillAnswers] = useState({})
  const [fillFeedback, setFillFeedback] = useState({})

  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    async function checkUser() {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.log('User is not signed in')
        setUser(null)
      } finally {
        setLoadingUser(false)
      }
    }

    checkUser()
  }, [])

  async function handleLogin() {
    try {
      await signInWithRedirect()
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  async function handleLogout() {
    try {
      await signOut()

      setUser(null)
      setSelectedFile(null)
      setUploadStatus('')
      setDocId('')
      setProcessingMessage('')
      setMcqExercises([])
      setFillExercises([])
      setMcqAnswers({})
      setMcqFeedback({})
      setFillAnswers({})
      setFillFeedback({})
      setCurrentStep(1)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]

    setUploadStatus('')
    setDocId('')
    setProcessingMessage('')
    setMcqExercises([])
    setFillExercises([])
    setMcqAnswers({})
    setMcqFeedback({})
    setFillAnswers({})
    setFillFeedback({})
    setCurrentStep(1)

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.type !== 'application/pdf') {
      setSelectedFile(null)
      setUploadStatus('Please select a PDF file.')
      return
    }

    setSelectedFile(file)
  }

  function generateDocId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID()
    }

    return (
      Date.now() +
      '-' +
      Math.random()
        .toString(36)
        .substring(2, 10)
    )
  }

  function normalizeAnswer(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,!?;:]+$/g, '')
  }

  function getCorrectMcqAnswer(exercise) {
    const answer = String(exercise?.answer ?? '').trim()

    const letterMatch = answer.match(/^([A-D])[\).:-]?$/i)

    if (
      letterMatch &&
      Array.isArray(exercise?.options)
    ) {
      const optionIndex =
        letterMatch[1]
          .toUpperCase()
          .charCodeAt(0) - 65

      return (
        exercise.options[optionIndex] ??
        answer
      )
    }

    return answer
  }

  function handleMcqAnswer(
    questionIndex,
    selectedOption,
    exercise
  ) {
    setMcqAnswers(prev => ({
      ...prev,
      [questionIndex]: selectedOption,
    }))

    const isCorrect =
      normalizeAnswer(selectedOption) ===
      normalizeAnswer(
        getCorrectMcqAnswer(exercise)
      )

    setMcqFeedback(prev => ({
      ...prev,
      [questionIndex]: isCorrect,
    }))
  }

  function handleFillAnswerChange(questionIndex, value) {
    setFillAnswers(prev => ({
      ...prev,
      [questionIndex]: value,
    }))

    setFillFeedback(prev => {
      const updated = { ...prev }
      delete updated[questionIndex]
      return updated
    })
  }

  function checkFillAnswer(questionIndex, exercise) {
    const studentAnswer =
      fillAnswers[questionIndex] || ''

    const correctAnswer =
      exercise?.answer || ''

    const isCorrect =
      normalizeAnswer(studentAnswer) ===
      normalizeAnswer(correctAnswer)

    setFillFeedback(prev => ({
      ...prev,
      [questionIndex]: isCorrect,
    }))
  }

  async function fetchDocumentStatus(currentDocId) {
    const accessToken = await getAccessToken()

    const response = await fetch(
      API_URL +
        '/documents/' +
        encodeURIComponent(currentDocId) +
        '/exercises',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      }
    )

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()

      throw new Error(
        'Status request failed: ' +
          response.status +
          ' ' +
          errorText
      )
    }

    return response.json()
  }

  async function pollDocumentStatus(currentDocId) {
    setCurrentStep(2)
    setProcessingMessage(
      'Starting document processing...'
    )

    for (let attempt = 0; attempt < 40; attempt++) {
      const data =
        await fetchDocumentStatus(currentDocId)

      if (data) {
        const status =
          data.status || 'UNKNOWN'

        setProcessingMessage(
          getStatusMessage(status)
        )

        if (status === 'EXERCISES_DONE') {
          setMcqExercises(
            Array.isArray(data.mcq)
              ? data.mcq
              : []
          )

          setFillExercises(
            Array.isArray(data.fillInTheBlank)
              ? data.fillInTheBlank
              : []
          )

          setCurrentStep(3)

          return
        }
      }

      await new Promise(resolve =>
        setTimeout(resolve, 3000)
      )
    }

    setProcessingMessage(
      'Processing is taking longer than expected.'
    )
  }

  async function handleUpload() {
    if (!selectedFile) {
      setUploadStatus(
        'Please select a PDF first.'
      )
      return
    }

    setIsUploading(true)
    setUploadStatus('Preparing upload...')
    setProcessingMessage('')
    setMcqExercises([])
    setFillExercises([])
    setMcqAnswers({})
    setMcqFeedback({})
    setFillAnswers({})
    setFillFeedback({})
    setCurrentStep(1)

    let currentDocId = ''
    let uploadSucceeded = false

    try {
      currentDocId = generateDocId()

      setDocId(currentDocId)

      const accessToken =
        await getAccessToken()

      setUploadStatus(
        'Preparing secure upload...'
      )

      const urlResponse = await fetch(
        API_URL + '/upload-url',
        {
          method: 'POST',
          headers: {
            Authorization:
              'Bearer ' + accessToken,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            docId: currentDocId,
          }),
        }
      )

      if (!urlResponse.ok) {
        const errorText =
          await urlResponse.text()

        throw new Error(
          'Upload URL request failed: ' +
            urlResponse.status +
            ' ' +
            errorText
        )
      }

      const data =
        await urlResponse.json()

      if (!data.uploadUrl) {
        throw new Error(
          'API did not return uploadUrl'
        )
      }

      setUploadStatus('Uploading PDF...')

      const uploadResponse = await fetch(
        data.uploadUrl,
        {
          method: 'PUT',

          headers: {
            'Content-Type':
              'application/pdf',
          },

          body: selectedFile,
        }
      )

      if (!uploadResponse.ok) {
        const errorText =
          await uploadResponse.text()

        throw new Error(
          'S3 upload failed: ' +
            uploadResponse.status +
            ' ' +
            errorText
        )
      }

      setUploadStatus(
        'Upload successful ✅'
      )

      uploadSucceeded = true
    } catch (error) {
      console.error(
        'Upload error:',
        error
      )

      setUploadStatus(
        'Upload failed: ' +
          error.message
      )
    } finally {
      setIsUploading(false)
    }

    if (uploadSucceeded) {
      try {
        await pollDocumentStatus(
          currentDocId
        )
      } catch (error) {
        console.error(
          'Processing status error:',
          error
        )

        setProcessingMessage(
          'Could not check document processing status.'
        )
      }
    }
  }

  if (loadingUser) {
    return (
      <div className="loading-screen">
        <h2>Loading...</h2>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand">
            <div className="brand-icon">☁</div>

            <div>
              <strong>AWS</strong>
              <span>SOLUTIONS</span>
            </div>
          </div>

          <h1>Vocabulary Builder</h1>

          <p>
            Turn your lessons into personalized
            exercises using AI.
          </p>

          <button onClick={handleLogin}>
            Sign In to Continue
          </button>
        </div>
      </div>
    )
  }

  const hasExercises =
    mcqExercises.length > 0 ||
    fillExercises.length > 0

  const displayName =
    user.signInDetails?.loginId ||
    'Student'

  return (
    <div className="app-shell">

      <header className="topbar">
        <div className="topbar-inner">

          <div className="brand">
            <div className="brand-icon">
              ☁
            </div>

            <div className="brand-text">
              <strong>AWS</strong>
              <span>SOLUTIONS</span>
            </div>
          </div>

          <nav className="main-nav">
            <a href="/">Home</a>
            <a href="/#about">About</a>
            <a href="/#skills">Skills</a>
            <a href="/#projects">Projects</a>

            <a
              href="#builder"
              className="active"
            >
              Vocabulary Builder
            </a>

            <a href="/#contact">
              Contact
            </a>
          </nav>

          <div className="user-menu">
            <div className="user-avatar">
              👤
            </div>

            <span>
              {displayName}
            </span>

            <button
              className="signout-button"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>

        </div>
      </header>

      <section
        className="builder-hero"
        id="builder"
      >
        <div className="hero-inner">

          <div className="hero-copy">

            <div className="eyebrow">
              LEARN &nbsp;•&nbsp;
              PRACTICE &nbsp;•&nbsp;
              IMPROVE
            </div>

            <h1>
              Vocabulary Builder
            </h1>

            <h2>
              Turn your lessons into
              personalized exercises using AI.
            </h2>

            <p>
              Upload a PDF and get vocabulary,
              comprehension and language
              practice in seconds.
            </p>

            <div className="hero-features">

              <span>
                ⚙ AI-Powered
              </span>

              <span>
                👤 Personalized
              </span>

              <span>
                ✓ Smart Practice
              </span>

            </div>
          </div>

          <div className="hero-visual">

            <div className="visual-card pdf-card">
              PDF
            </div>

            <div className="visual-arrow">
              →
            </div>

            <div className="visual-card ai-card">
              AI
            </div>

            <div className="visual-output">
              <span>Vocabulary</span>
              <span>Comprehension</span>
              <span>Grammar</span>
              <span>Writing</span>
            </div>

          </div>
        </div>
      </section>

      <div className="page-content">

        <section className="steps-card">

          <div
            className={
              currentStep >= 1
                ? 'step active-step'
                : 'step'
            }
          >
            <div className="step-number">
              1
            </div>

            <div>
              <strong>Upload PDF</strong>
              <span>
                Choose your lesson document
              </span>
            </div>
          </div>

          <div className="step-arrow">
            →
          </div>

          <div
            className={
              currentStep >= 2
                ? 'step active-step'
                : 'step'
            }
          >
            <div className="step-number">
              2
            </div>

            <div>
              <strong>Processing</strong>
              <span>
                AI is analyzing your content
              </span>
            </div>
          </div>

          <div className="step-arrow">
            →
          </div>

          <div
            className={
              currentStep >= 3
                ? 'step active-step'
                : 'step'
            }
          >
            <div className="step-number">
              3
            </div>

            <div>
              <strong>
                Exercises Ready
              </strong>

              <span>
                Start practicing
              </span>
            </div>
          </div>

        </section>

        <div className="dashboard-grid">

          <div className="dashboard-main">

            <section
              className="dashboard-card upload-card"
              id="upload"
            >

              <div className="card-heading">
                <div className="card-icon">
                  ⇧
                </div>

                <div>
                  <h2>
                    Upload Your Lesson
                  </h2>

                  <p>
                    PDF documents only
                  </p>
                </div>
              </div>

              <div className="upload-zone">

                <div className="upload-symbol">
                  ☁
                </div>

                <h3>
                  Choose your lesson PDF
                </h3>

                <p>
                  Upload a lesson, article,
                  worksheet or reading material.
                </p>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={
                    handleFileChange
                  }
                />

                {selectedFile && (
                  <div className="selected-file">
                    Selected:
                    <strong>
                      {' '}
                      {selectedFile.name}
                    </strong>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={
                    !selectedFile ||
                    isUploading
                  }
                >
                  {isUploading
                    ? 'Uploading...'
                    : 'Upload PDF'}
                </button>

                {uploadStatus && (
                  <div className="status-text">
                    {uploadStatus}
                  </div>
                )}

              </div>
            </section>

            <section className="dashboard-card processing-card">

              <div className="card-heading">

                <div className="card-icon">
                  ◌
                </div>

                <div>
                  <h2>
                    Processing Your Document
                  </h2>

                  <p>
                    Extracting text and
                    generating exercises.
                  </p>
                </div>
              </div>

              <div className="processing-area">

                {processingMessage ? (
                  <strong>
                    {processingMessage}
                  </strong>
                ) : (
                  <span>
                    No active processing job.
                  </span>
                )}

                <div className="progress-track">

                  <div
                    className="progress-fill"
                    style={{
                      width:
                        currentStep === 1
                          ? '10%'
                          : currentStep === 2
                          ? '60%'
                          : '100%',
                    }}
                  />

                </div>

              </div>
            </section>

            <section className="dashboard-card exercises-card">

              <div className="card-heading">

                <div className="card-icon">
                  📖
                </div>

                <div>
                  <h2>
                    Practice Exercises
                  </h2>

                  <p>
                    Practice the material
                    generated from your lesson.
                  </p>
                </div>

              </div>

              {!hasExercises && (
                <div className="empty-exercises">
                  Your generated exercises
                  will appear here.
                </div>
              )}

              {mcqExercises.length > 0 && (
                <div className="exercise-section">

                  <div className="exercise-title-row">
                    <h3>
                      Multiple Choice
                    </h3>

                    <span className="exercise-badge">
                      {mcqExercises.length}
                      {' '}
                      Questions
                    </span>
                  </div>

                  {mcqExercises.map(
                    (exercise, index) => (
                      <div
                        className="question-card"
                        key={
                          'mcq-' + index
                        }
                      >

                        <div className="question-number">
                          Question {index + 1}
                        </div>

                        <h4>
                          {exercise.question}
                        </h4>

                        <div className="options-list">

                          {Array.isArray(
                            exercise.options
                          ) &&
                            exercise.options.map(
                              (
                                option,
                                optionIndex
                              ) => (
                                <label
                                  className="option-row"
                                  key={
                                    optionIndex
                                  }
                                >
                                  <input
                                    type="radio"
                                    name={
                                      'mcq-' +
                                      index
                                    }
                                    checked={
                                      mcqAnswers[index] ===
                                      option
                                    }
                                    onChange={() =>
                                      handleMcqAnswer(
                                        index,
                                        option,
                                        exercise
                                      )
                                    }
                                  />

                                  <span>
                                    {option}
                                  </span>
                                </label>
                              )
                            )}

                        </div>

                        {mcqFeedback[index] !== undefined && (
                          <div
                            style={{
                              marginTop: '12px',
                              fontWeight: '700',
                              color: mcqFeedback[index]
                                ? '#168447'
                                : '#d63b3b',
                            }}
                          >
                            {mcqFeedback[index]
                              ? 'Correct ✅'
                              : 'Try again ❌'}
                          </div>
                        )}
                      </div>
                    )
                  )}

                </div>
              )}

              {fillExercises.length > 0 && (
                <div className="exercise-section">

                  <div className="exercise-title-row">

                    <h3>
                      Fill in the Blank
                    </h3>

                    <span className="exercise-badge">
                      {fillExercises.length}
                      {' '}
                      Questions
                    </span>

                  </div>

                  {fillExercises.map(
                    (exercise, index) => (
                      <div
                        className="question-card"
                        key={
                          'fill-' + index
                        }
                      >

                        <div className="question-number">
                          Question {index + 1}
                        </div>

                        <h4>
                          {exercise.question}
                        </h4>

                        <div className="fill-answer-area">
                          <input
                            type="text"
                            placeholder="Type your answer"
                            value={
                              fillAnswers[index] || ''
                            }
                            onChange={event =>
                              handleFillAnswerChange(
                                index,
                                event.target.value
                              )
                            }
                            onKeyDown={event => {
                              if (
                                event.key === 'Enter' &&
                                fillAnswers[index]?.trim()
                              ) {
                                checkFillAnswer(
                                  index,
                                  exercise
                                )
                              }
                            }}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              checkFillAnswer(
                                index,
                                exercise
                              )
                            }
                            disabled={
                              !fillAnswers[index]?.trim()
                            }
                            style={{
                              marginTop: '10px',
                              border: 'none',
                              borderRadius: '9px',
                              padding: '10px 18px',
                              background: '#087cff',
                              color: '#ffffff',
                              fontWeight: '700',
                              cursor:
                                fillAnswers[index]?.trim()
                                  ? 'pointer'
                                  : 'not-allowed',
                              opacity:
                                fillAnswers[index]?.trim()
                                  ? 1
                                  : 0.5,
                            }}
                          >
                            Check Answer
                          </button>

                          {fillFeedback[index] !== undefined && (
                            <div
                              style={{
                                marginTop: '12px',
                                fontWeight: '700',
                                color: fillFeedback[index]
                                  ? '#168447'
                                  : '#d63b3b',
                              }}
                            >
                              {fillFeedback[index]
                                ? 'Correct ✅'
                                : 'Try again ❌'}
                            </div>
                          )}
                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>

          </div>

          <aside className="dashboard-sidebar">

            <section className="side-card">

              <h3>
                How It Works
              </h3>

              <div className="mini-step">
                <span>1</span>
                Upload your PDF
              </div>

              <div className="mini-step">
                <span>2</span>
                AI processes the lesson
              </div>

              <div className="mini-step">
                <span>3</span>
                Practice your exercises
              </div>

            </section>

            <section className="side-card">

              <h3>
                Tips for Better Results
              </h3>

              <p>
                ✓ Use clear, text-based PDFs.
              </p>

              <p>
                ✓ Lessons with real articles
                work best.
              </p>

              <p>
                ✓ Longer lessons can create
                more varied practice.
              </p>

              <p>
                ✓ Try different topics to
                expand your vocabulary.
              </p>

            </section>

            <section className="side-card quote-card">

              <div className="quote-mark">
                “
              </div>

              <p>
                A new language is a new way
                of seeing the world.
              </p>

            </section>

          </aside>

        </div>
      </div>

      <footer className="site-footer">

        <div className="footer-inner">

          <div className="footer-brand">

            <div className="brand">
              <div className="brand-icon">
                ☁
              </div>

              <div className="brand-text">
                <strong>AWS</strong>
                <span>SOLUTIONS</span>
              </div>
            </div>

            <p>
              Building secure, scalable
              solutions for a better tomorrow.
            </p>

          </div>

          <div className="footer-links">

            <h4>
              Quick Links
            </h4>

            <a href="/">
              Home
            </a>

            <a href="/#projects">
              Projects
            </a>

            <a href="#builder">
              Vocabulary Builder
            </a>

            <a href="/#contact">
              Contact
            </a>

          </div>

          <div className="footer-contact">

            <h4>
              AWS Solutions
            </h4>

            <p>
              Secure • Serverless • AI
            </p>

          </div>

        </div>

        <div className="footer-bottom">
          © 2026 AWS Solutions.
          All rights reserved.
        </div>

      </footer>

    </div>
  )
}