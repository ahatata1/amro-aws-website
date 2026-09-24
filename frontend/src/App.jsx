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
    throw new Error(
      'No Cognito access token found'
    )
  }

  return token
}


function getStatusMessage(status) {
  if (status === 'TEXTRACT_SUBMITTED') {
    return 'Reading your document...'
  }

  if (status === 'TEXTRACT_DONE') {
    return 'Creating your homework...'
  }

  if (status === 'EXERCISES_DONE') {
    return 'Homework ready ✅'
  }

  return 'Processing your document...'
}


export default function App() {
  const [user, setUser] =
    useState(null)

  const [loadingUser, setLoadingUser] =
    useState(true)

  const [selectedFile, setSelectedFile] =
    useState(null)

  const [uploadStatus, setUploadStatus] =
    useState('')

  const [isUploading, setIsUploading] =
    useState(false)

  const [docId, setDocId] =
    useState('')

  const [
    processingMessage,
    setProcessingMessage,
  ] = useState('')


  // ============================================
  // NEW HOMEWORK101 DATA
  // ============================================

  const [
    homeworkMetadata,
    setHomeworkMetadata,
  ] = useState(null)

  const [
    targetLanguage,
    setTargetLanguage,
  ] = useState([])

  const [
    sections,
    setSections,
  ] = useState([])

  const [
    writingTask,
    setWritingTask,
  ] = useState(null)


  // ============================================
  // STUDENT ANSWERS
  // ============================================

  const [answers, setAnswers] =
    useState({})

  const [feedback, setFeedback] =
    useState({})

  const [
    writingResponse,
    setWritingResponse,
  ] = useState('')


  // ============================================
  // HOMEWORK EVALUATION
  // ============================================

  const [
    isSubmittingHomework,
    setIsSubmittingHomework,
  ] = useState(false)

  const [
    evaluationStatus,
    setEvaluationStatus,
  ] = useState('')

  const [
    evaluationResult,
    setEvaluationResult,
  ] = useState(null)


  // ============================================
  // LEGACY SUPPORT
  // ============================================

  const [
    legacyMcq,
    setLegacyMcq,
  ] = useState([])

  const [
    legacyFill,
    setLegacyFill,
  ] = useState([])


  const [currentStep, setCurrentStep] =
    useState(1)


  useEffect(() => {
    async function checkUser() {
      try {
        const currentUser =
          await getCurrentUser()

        setUser(currentUser)
      } catch (error) {
        console.log(
          'User is not signed in'
        )

        setUser(null)
      } finally {
        setLoadingUser(false)
      }
    }

    checkUser()
  }, [])


  function resetHomework() {
    setHomeworkMetadata(null)
    setTargetLanguage([])
    setSections([])
    setWritingTask(null)

    setAnswers({})
    setFeedback({})
    setWritingResponse('')

    setIsSubmittingHomework(false)
    setEvaluationStatus('')
    setEvaluationResult(null)

    setLegacyMcq([])
    setLegacyFill([])
  }


  async function handleLogin() {
    try {
      await signInWithRedirect()
    } catch (error) {
      console.error(
        'Login error:',
        error
      )
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
      setCurrentStep(1)

      resetHomework()
    } catch (error) {
      console.error(
        'Logout error:',
        error
      )
    }
  }


  function handleFileChange(event) {
    const file =
      event.target.files?.[0]

    setUploadStatus('')
    setDocId('')
    setProcessingMessage('')
    setCurrentStep(1)

    resetHomework()

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (
      file.type !==
      'application/pdf'
    ) {
      setSelectedFile(null)

      setUploadStatus(
        'Please select a PDF file.'
      )

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


  // ============================================
  // ANSWER HELPERS
  // ============================================

  function normalizeAnswer(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,!?;:]+$/g, '')
  }


  function getCorrectMcqAnswer(
    exercise
  ) {
    const answer =
      String(
        exercise?.answer ?? ''
      ).trim()

    const letterMatch =
      answer.match(
        /^([A-D])[\).:-]?$/i
      )

    if (
      letterMatch &&
      Array.isArray(
        exercise?.options
      )
    ) {
      const optionIndex =
        letterMatch[1]
          .toUpperCase()
          .charCodeAt(0) - 65

      return (
        exercise.options[
          optionIndex
        ] ?? answer
      )
    }

    return answer
  }


  function getQuestionKey(
    sectionIndex,
    questionIndex
  ) {
    return (
      sectionIndex +
      '-' +
      questionIndex
    )
  }


  function getAcceptedAnswers(
    question
  ) {
    const possible = []

    if (question?.answer) {
      possible.push(
        question.answer
      )
    }

    if (
      Array.isArray(
        question?.acceptedAnswers
      )
    ) {
      possible.push(
        ...question.acceptedAnswers
      )
    }

    return possible
  }


  function handleChoiceAnswer(
    key,
    selectedOption,
    question
  ) {
    setAnswers(prev => ({
      ...prev,
      [key]: selectedOption,
    }))

    if (
      question?.evaluationMode ===
      'exact'
    ) {
      const correct =
        normalizeAnswer(
          selectedOption
        ) ===
        normalizeAnswer(
          getCorrectMcqAnswer(
            question
          )
        )

      setFeedback(prev => ({
        ...prev,
        [key]: correct,
      }))
    }
  }


  function handleTextChange(
    key,
    value
  ) {
    setAnswers(prev => ({
      ...prev,
      [key]: value,
    }))

    setFeedback(prev => {
      const updated = {
        ...prev,
      }

      delete updated[key]

      return updated
    })
  }


  function checkTextAnswer(
    key,
    question
  ) {
    const studentAnswer =
      answers[key] || ''

    const accepted =
      getAcceptedAnswers(
        question
      )

    const correct =
      accepted.some(
        answer =>
          normalizeAnswer(
            answer
          ) ===
          normalizeAnswer(
            studentAnswer
          )
      )

    setFeedback(prev => ({
      ...prev,
      [key]: correct,
    }))
  }


  function handleMatchingChange(
    key,
    pairIndex,
    value
  ) {
    setAnswers(prev => ({
      ...prev,

      [key]: {
        ...(prev[key] || {}),

        [pairIndex]:
          value,
      },
    }))

    setFeedback(prev => {
      const updated = {
        ...prev,
      }

      delete updated[key]

      return updated
    })
  }


  function checkMatchingAnswer(
    key,
    question
  ) {
    const pairs =
      Array.isArray(
        question?.matchingPairs
      )
        ? question.matchingPairs
        : []

    const studentMatches =
      answers[key] || {}

    const correct =
      pairs.length > 0 &&
      pairs.every(
        (pair, pairIndex) =>
          normalizeAnswer(
            studentMatches[
              pairIndex
            ]
          ) ===
          normalizeAnswer(
            pair.right
          )
      )

    setFeedback(prev => ({
      ...prev,
      [key]: correct,
    }))
  }


  function renderFeedback(key) {
    if (
      feedback[key] === undefined
    ) {
      return null
    }

    const correct =
      feedback[key]

    return (
      <div
        style={{
          marginTop: '12px',
          fontWeight: '700',
          color: correct
            ? '#168447'
            : '#d63b3b',
        }}
      >
        {correct
          ? 'Correct ✅'
          : 'Try again ❌'}
      </div>
    )
  }


  // ============================================
  // API
  // ============================================

  async function fetchDocumentStatus(
    currentDocId
  ) {
    const accessToken =
      await getAccessToken()

    const response =
      await fetch(
        API_URL +
          '/documents/' +
          encodeURIComponent(
            currentDocId
          ) +
          '/exercises',
        {
          method: 'GET',

          headers: {
            Authorization:
              'Bearer ' +
              accessToken,
          },
        }
      )

    if (
      response.status === 404
    ) {
      return null
    }

    if (!response.ok) {
      const errorText =
        await response.text()

      throw new Error(
        'Status request failed: ' +
          response.status +
          ' ' +
          errorText
      )
    }

    return response.json()
  }


  async function pollDocumentStatus(
    currentDocId
  ) {
    setCurrentStep(2)

    setProcessingMessage(
      'Starting document processing...'
    )

    for (
      let attempt = 0;
      attempt < 40;
      attempt++
    ) {
      const data =
        await fetchDocumentStatus(
          currentDocId
        )

      if (data) {
        const status =
          data.status || 'UNKNOWN'

        setProcessingMessage(
          getStatusMessage(
            status
          )
        )

        if (
          status ===
          'EXERCISES_DONE'
        ) {

          // NEW STRUCTURE

          setHomeworkMetadata(
            data.metadata || null
          )

          setTargetLanguage(
            Array.isArray(
              data.targetLanguage
            )
              ? data.targetLanguage
              : []
          )

          setSections(
            Array.isArray(
              data.sections
            )
              ? data.sections
              : []
          )

          setWritingTask(
            data.writingTask ||
              null
          )


          // OLD STRUCTURE SUPPORT

          setLegacyMcq(
            Array.isArray(data.mcq)
              ? data.mcq
              : []
          )

          setLegacyFill(
            Array.isArray(
              data.fillInTheBlank
            )
              ? data.fillInTheBlank
              : []
          )


          setCurrentStep(3)

          return
        }
      }

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            3000
          )
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

    setUploadStatus(
      'Preparing upload...'
    )

    setProcessingMessage('')

    setCurrentStep(1)

    resetHomework()

    let currentDocId = ''

    let uploadSucceeded =
      false

    try {
      currentDocId =
        generateDocId()

      setDocId(
        currentDocId
      )

      const accessToken =
        await getAccessToken()

      setUploadStatus(
        'Preparing secure upload...'
      )

      const urlResponse =
        await fetch(
          API_URL +
            '/upload-url',
          {
            method: 'POST',

            headers: {
              Authorization:
                'Bearer ' +
                accessToken,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                docId:
                  currentDocId,
              }),
          }
        )

      if (
        !urlResponse.ok
      ) {
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

      setUploadStatus(
        'Uploading PDF...'
      )

      const uploadResponse =
        await fetch(
          data.uploadUrl,
          {
            method: 'PUT',

            headers: {
              'Content-Type':
                'application/pdf',
            },

            body:
              selectedFile,
          }
        )

      if (
        !uploadResponse.ok
      ) {
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

      uploadSucceeded =
        true

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


    if (
      uploadSucceeded
    ) {
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



  // ============================================
  // SUBMIT COMPLETE HOMEWORK FOR EVALUATION
  // ============================================

  function buildSubmissionAnswers() {
    const submitted = []

    sections.forEach(
      (section, sectionIndex) => {
        const sectionId =
          section?.id ??
          sectionIndex + 1

        const questions =
          Array.isArray(
            section?.questions
          )
            ? section.questions
            : []

        questions.forEach(
          (question, questionIndex) => {
            const key =
              getQuestionKey(
                sectionIndex,
                questionIndex
              )

            submitted.push({
              sectionId,

              questionId:
                question?.id ??
                questionIndex + 1,

              answer:
                answers[key] ??
                '',
            })
          }
        )
      }
    )

    return submitted
  }


  async function handleSubmitHomework() {
    if (!docId) {
      setEvaluationStatus(
        'Cannot submit: document ID is missing.'
      )

      return
    }

    if (!sections.length) {
      setEvaluationStatus(
        'There is no homework to submit.'
      )

      return
    }

    setIsSubmittingHomework(true)
    setEvaluationStatus(
      'Submitting homework for evaluation...'
    )
    setEvaluationResult(null)

    try {
      const accessToken =
        await getAccessToken()

      const response =
        await fetch(
          API_URL +
            '/documents/' +
            encodeURIComponent(
              docId
            ) +
            '/evaluate',
          {
            method: 'POST',

            headers: {
              Authorization:
                'Bearer ' +
                accessToken,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                answers:
                  buildSubmissionAnswers(),

                writingAnswer:
                  writingResponse,
              }),
          }
        )

      const responseText =
        await response.text()

      let data = null

      try {
        data = responseText
          ? JSON.parse(
              responseText
            )
          : {}
      } catch {
        data = null
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            responseText ||
            'Evaluation request failed'
        )
      }

      if (!data) {
        throw new Error(
          'Evaluation API returned invalid JSON'
        )
      }

      setEvaluationResult(data)

      setEvaluationStatus(
        'Homework evaluated ✅'
      )

      window.setTimeout(
        () => {
          document
            .getElementById(
              'evaluation-report'
            )
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
        },
        100
      )

    } catch (error) {
      console.error(
        'Homework evaluation error:',
        error
      )

      setEvaluationStatus(
        'Evaluation failed: ' +
          error.message
      )

    } finally {
      setIsSubmittingHomework(false)
    }
  }


  function findQuestionForResult(
    result
  ) {
    const section =
      sections.find(
        item =>
          String(item?.id) ===
          String(
            result?.sectionId
          )
      )

    const question =
      Array.isArray(
        section?.questions
      )
        ? section.questions.find(
            item =>
              String(item?.id) ===
              String(
                result?.questionId
              )
          )
        : null

    return {
      section,
      question,
    }
  }


  // ============================================
  // QUESTION RENDERER
  // ============================================

  function renderQuestion(
    question,
    sectionIndex,
    questionIndex
  ) {
    const key =
      getQuestionKey(
        sectionIndex,
        questionIndex
      )

    const type =
      question?.questionType ||
      'short_answer'

    const evaluationMode =
      question?.evaluationMode ||
      'exact'

    const options =
      Array.isArray(
        question?.options
      )
        ? question.options
        : []

    const matchingPairs =
      Array.isArray(
        question?.matchingPairs
      )
        ? question.matchingPairs
        : []


    return (
      <div
        className="question-card"
        key={key}
      >

        <div className="question-number">
          Question {questionIndex + 1}
        </div>


        <h4>
          {question.question}
        </h4>


        {type ===
          'multiple_choice' && (

          <div className="options-list">

            {options.map(
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
                      'question-' +
                      key
                    }
                    checked={
                      answers[key] ===
                      option
                    }
                    onChange={() =>
                      handleChoiceAnswer(
                        key,
                        option,
                        question
                      )
                    }
                  />

                  <span>
                    {option}
                  </span>

                </label>

              )
            )}

            {renderFeedback(
              key
            )}

          </div>
        )}


        {type ===
          'gap_fill' && (

          <div className="fill-answer-area">

            <input
              type="text"
              placeholder="Type your answer"
              value={
                answers[key] ||
                ''
              }
              onChange={
                event =>
                  handleTextChange(
                    key,
                    event.target.value
                  )
              }
              onKeyDown={
                event => {
                  if (
                    event.key ===
                      'Enter' &&
                    answers[
                      key
                    ]?.trim()
                  ) {
                    checkTextAnswer(
                      key,
                      question
                    )
                  }
                }
              }
            />


            <button
              type="button"
              onClick={() =>
                checkTextAnswer(
                  key,
                  question
                )
              }
              disabled={
                !answers[
                  key
                ]?.trim()
              }
              style={{
                marginTop:
                  '10px',

                border:
                  'none',

                borderRadius:
                  '9px',

                padding:
                  '10px 18px',

                background:
                  '#087cff',

                color:
                  '#ffffff',

                fontWeight:
                  '700',

                cursor:
                  answers[
                    key
                  ]?.trim()
                    ? 'pointer'
                    : 'not-allowed',

                opacity:
                  answers[
                    key
                  ]?.trim()
                    ? 1
                    : 0.5,
              }}
            >
              Check Answer
            </button>

            {renderFeedback(
              key
            )}

          </div>
        )}


        {type ===
          'matching' && (

          <div
            style={{
              marginTop:
                '18px',
            }}
          >

            {matchingPairs.map(
              (
                pair,
                pairIndex
              ) => {

                const rightOptions =
                  matchingPairs
                    .map(
                      item =>
                        item.right
                    )
                    .sort()

                return (
                  <div
                    key={
                      pairIndex
                    }
                    style={{
                      marginBottom:
                        '14px',

                      padding:
                        '14px',

                      border:
                        '1px solid #e2e8f0',

                      borderRadius:
                        '10px',

                      background:
                        '#f8fafc',
                    }}
                  >

                    <strong>
                      {pair.left}
                    </strong>

                    <select
                      value={
                        answers[
                          key
                        ]?.[
                          pairIndex
                        ] || ''
                      }
                      onChange={
                        event =>
                          handleMatchingChange(
                            key,
                            pairIndex,
                            event
                              .target
                              .value
                          )
                      }
                      style={{
                        display:
                          'block',

                        width:
                          '100%',

                        marginTop:
                          '8px',

                        padding:
                          '10px',

                        borderRadius:
                          '8px',

                        border:
                          '1px solid #cbd5e1',
                      }}
                    >

                      <option value="">
                        Choose a match
                      </option>

                      {rightOptions.map(
                        (
                          option,
                          optionIndex
                        ) => (
                          <option
                            key={
                              optionIndex
                            }
                            value={
                              option
                            }
                          >
                            {
                              option
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>
                )
              }
            )}


            <button
              type="button"
              onClick={() =>
                checkMatchingAnswer(
                  key,
                  question
                )
              }
              style={{
                border:
                  'none',

                borderRadius:
                  '9px',

                padding:
                  '10px 18px',

                background:
                  '#087cff',

                color:
                  '#ffffff',

                fontWeight:
                  '700',

                cursor:
                  'pointer',
              }}
            >
              Check Answers
            </button>

            {renderFeedback(
              key
            )}

          </div>
        )}


        {(
          type ===
            'short_answer' ||
          type ===
            'open_response' ||
          type ===
            'paraphrase'
        ) && (

          <div
            style={{
              marginTop:
                '16px',
            }}
          >

            {evaluationMode ===
              'exact' ? (

              <>
                <input
                  type="text"
                  placeholder="Type your answer"
                  value={
                    answers[
                      key
                    ] || ''
                  }
                  onChange={
                    event =>
                      handleTextChange(
                        key,
                        event
                          .target
                          .value
                      )
                  }
                  style={{
                    width:
                      '100%',

                    padding:
                      '12px',

                    borderRadius:
                      '9px',

                    border:
                      '1px solid #cbd5e1',
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    checkTextAnswer(
                      key,
                      question
                    )
                  }
                  style={{
                    marginTop:
                      '10px',

                    border:
                      'none',

                    borderRadius:
                      '9px',

                    padding:
                      '10px 18px',

                    background:
                      '#087cff',

                    color:
                      '#ffffff',

                    fontWeight:
                      '700',

                    cursor:
                      'pointer',
                  }}
                >
                  Check Answer
                </button>

                {renderFeedback(
                  key
                )}
              </>

            ) : (

              <>
                <textarea
                  placeholder={
                    evaluationMode ===
                    'ai_review'
                      ? 'Write your response and explain your reasoning...'
                      : 'Write your answer...'
                  }
                  value={
                    answers[
                      key
                    ] || ''
                  }
                  onChange={
                    event =>
                      handleTextChange(
                        key,
                        event
                          .target
                          .value
                      )
                  }
                  rows="5"
                  style={{
                    width:
                      '100%',

                    padding:
                      '12px',

                    borderRadius:
                      '9px',

                    border:
                      '1px solid #cbd5e1',

                    resize:
                      'vertical',

                    fontFamily:
                      'inherit',

                    lineHeight:
                      '1.5',
                  }}
                />

                <div
                  style={{
                    marginTop:
                      '8px',

                    fontSize:
                      '13px',

                    color:
                      '#64748b',
                  }}
                >

                  {evaluationMode ===
                  'ai_review'
                    ? 'Open response — AI will review this when you submit the homework.'
                    : 'Meaning-based answer — AI will check this when you submit the homework.'}

                </div>
              </>

            )}

          </div>
        )}


        {Array.isArray(
          question?.usefulVocabulary
        ) &&
          question
            .usefulVocabulary
            .length >
            0 && (

          <div
            style={{
              marginTop:
                '15px',

              fontSize:
                '13px',

              color:
                '#64748b',
            }}
          >
            <strong>
              Useful language:
            </strong>{' '}

            {question
              .usefulVocabulary
              .join(', ')}
          </div>
        )}

      </div>
    )
  }


  // ============================================
  // LOADING / LOGIN
  // ============================================

  if (loadingUser) {
    return (
      <div className="loading-screen">
        <h2>
          Loading...
        </h2>
      </div>
    )
  }


  if (!user) {
    return (
      <div className="login-page">

        <div className="login-card">

          <div className="brand">

            <div className="brand-icon">
              ☁
            </div>

            <div>
              <strong>
                AWS
              </strong>

              <span>
                SOLUTIONS
              </span>
            </div>

          </div>


          <h1>
            Vocabulary Builder
          </h1>


          <p>
            Turn your lessons into
            personalized exercises
            using AI.
          </p>


          <button
            onClick={
              handleLogin
            }
          >
            Sign In to Continue
          </button>

        </div>

      </div>
    )
  }


  const hasNewHomework =
    sections.length > 0


  const hasLegacyExercises =
    legacyMcq.length > 0 ||
    legacyFill.length > 0


  const hasExercises =
    hasNewHomework ||
    hasLegacyExercises


  const displayName =
    user.signInDetails
      ?.loginId ||
    'Student'


  const writingWordCount =
    writingResponse
      .trim()
      ? writingResponse
          .trim()
          .split(/\s+/)
          .length
      : 0


  const evaluationQuestionResults =
    Array.isArray(
      evaluationResult
        ?.questionResults
    )
      ? evaluationResult
          .questionResults
      : []


  const sectionScoreRows =
    sections
      .map(
        (section, sectionIndex) => {
          const sectionId =
            section?.id ??
            sectionIndex + 1

          const results =
            evaluationQuestionResults
              .filter(
                result =>
                  String(
                    result?.sectionId
                  ) ===
                  String(
                    sectionId
                  )
              )

          const earned =
            results.reduce(
              (total, result) =>
                total +
                Number(
                  result?.score ||
                  0
                ),
              0
            )

          const maximum =
            results.reduce(
              (total, result) =>
                total +
                Number(
                  result?.maxScore ||
                  0
                ),
              0
            )

          return {
            sectionId,

            title:
              section?.title ||
              'Section ' +
                (sectionIndex + 1),

            score:
              maximum > 0
                ? Math.round(
                    (
                      earned /
                      maximum
                    ) *
                      100
                  )
                : 0,

            count:
              results.length,
          }
        }
      )
      .filter(
        item =>
          item.count > 0
      )


  const sortedEvaluationResults =
    [...evaluationQuestionResults]
      .sort(
        (a, b) => {
          const sectionDifference =
            Number(
              a?.sectionId ||
              0
            ) -
            Number(
              b?.sectionId ||
              0
            )

          if (
            sectionDifference !== 0
          ) {
            return sectionDifference
          }

          return (
            Number(
              a?.questionId ||
              0
            ) -
            Number(
              b?.questionId ||
              0
            )
          )
        }
      )


  return (
    <div className="app-shell">

      <header className="topbar">

        <div className="topbar-inner">

          <div className="brand">

            <div className="brand-icon">
              ☁
            </div>

            <div className="brand-text">
              <strong>
                AWS
              </strong>

              <span>
                SOLUTIONS
              </span>
            </div>

          </div>


          <nav className="main-nav">

            <a href="/">
              Home
            </a>

            <a href="/#about">
              About
            </a>

            <a href="/#skills">
              Skills
            </a>

            <a href="/#projects">
              Projects
            </a>

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
              onClick={
                handleLogout
              }
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
              personalized homework using AI.
            </h2>

            <p>
              Upload a PDF and get
              vocabulary, comprehension,
              practical language and
              writing practice.
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
              <span>
                Vocabulary
              </span>

              <span>
                Comprehension
              </span>

              <span>
                Situations
              </span>

              <span>
                Writing
              </span>
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
              <strong>
                Upload PDF
              </strong>

              <span>
                Choose your lesson
                document
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
              <strong>
                Processing
              </strong>

              <span>
                AI is analysing
                your content
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
                Homework Ready
              </strong>

              <span>
                Start practising
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
                  Upload a lesson,
                  article, worksheet
                  or reading material.
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
                      {
                        selectedFile.name
                      }
                    </strong>

                  </div>

                )}


                <button
                  onClick={
                    handleUpload
                  }
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
                    generating homework.
                  </p>

                </div>

              </div>


              <div className="processing-area">

                {processingMessage ? (

                  <strong>
                    {
                      processingMessage
                    }
                  </strong>

                ) : (

                  <span>
                    No active processing
                    job.
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
                    Homework Practice
                  </h2>

                  <p>
                    Practice the language,
                    ideas and situations
                    generated from your lesson.
                  </p>

                </div>

              </div>


              {!hasExercises && (

                <div className="empty-exercises">

                  Your generated homework
                  will appear here.

                </div>

              )}


              {hasNewHomework && (
                <>

                  {homeworkMetadata && (

                    <div
                      style={{
                        marginBottom:
                          '28px',

                        padding:
                          '20px',

                        borderRadius:
                          '14px',

                        background:
                          '#f8fafc',

                        border:
                          '1px solid #e2e8f0',
                      }}
                    >

                      <h2
                        style={{
                          marginTop: 0,
                        }}
                      >
                        {
                          homeworkMetadata.title
                        }
                      </h2>


                      <div
                        style={{
                          display:
                            'flex',

                          gap:
                            '10px',

                          flexWrap:
                            'wrap',

                          marginBottom:
                            '15px',
                        }}
                      >

                        {homeworkMetadata.level && (

                          <span className="exercise-badge">
                            Level:{' '}
                            {
                              homeworkMetadata.level
                            }
                          </span>

                        )}


                        {homeworkMetadata.estimatedTime && (

                          <span className="exercise-badge">
                            ⏱{' '}
                            {
                              homeworkMetadata.estimatedTime
                            }
                          </span>

                        )}

                      </div>


                      {homeworkMetadata.topic && (

                        <p>
                          <strong>
                            Topic:
                          </strong>{' '}
                          {
                            homeworkMetadata.topic
                          }
                        </p>

                      )}


                      {Array.isArray(
                        homeworkMetadata.homeworkGoals
                      ) &&
                        homeworkMetadata
                          .homeworkGoals
                          .length >
                          0 && (

                        <div>

                          <strong>
                            Homework goals
                          </strong>

                          <ul>
                            {
                              homeworkMetadata
                                .homeworkGoals
                                .map(
                                  (
                                    goal,
                                    index
                                  ) => (
                                    <li
                                      key={
                                        index
                                      }
                                    >
                                      {
                                        goal
                                      }
                                    </li>
                                  )
                                )
                            }
                          </ul>

                        </div>

                      )}

                    </div>

                  )}


                  {targetLanguage.length >
                    0 && (

                    <div
                      style={{
                        marginBottom:
                          '30px',
                      }}
                    >

                      <h3>
                        Target Language
                      </h3>

                      <div
                        style={{
                          display:
                            'flex',

                          flexWrap:
                            'wrap',

                          gap:
                            '8px',
                        }}
                      >

                        {targetLanguage.map(
                          (
                            item,
                            index
                          ) => (

                            <span
                              key={
                                index
                              }
                              style={{
                                padding:
                                  '8px 12px',

                                borderRadius:
                                  '20px',

                                background:
                                  '#eaf3ff',

                                color:
                                  '#075db8',

                                fontWeight:
                                  '600',

                                fontSize:
                                  '14px',
                              }}
                            >
                              {
                                item.item
                              }
                            </span>

                          )
                        )}

                      </div>

                    </div>

                  )}


                  {sections.map(
                    (
                      section,
                      sectionIndex
                    ) => (

                      <div
                        className="exercise-section"
                        key={
                          section.id ??
                          sectionIndex
                        }
                      >

                        <div className="exercise-title-row">

                          <h3>
                            {
                              section.title
                            }
                          </h3>

                          <span className="exercise-badge">
                            {
                              Array.isArray(
                                section.questions
                              )
                                ? section
                                    .questions
                                    .length
                                : 0
                            }
                            {' '}
                            Questions
                          </span>

                        </div>


                        {section.instructions && (

                          <p
                            style={{
                              marginBottom:
                                '18px',

                              color:
                                '#475569',

                              lineHeight:
                                '1.6',
                            }}
                          >
                            {
                              section.instructions
                            }
                          </p>

                        )}


                        {Array.isArray(
                          section.wordBank
                        ) &&
                          section
                            .wordBank
                            .length >
                            0 && (

                          <div
                            style={{
                              marginBottom:
                                '20px',

                              padding:
                                '14px',

                              background:
                                '#f8fafc',

                              borderRadius:
                                '10px',
                            }}
                          >

                            <strong>
                              Word Bank:
                            </strong>{' '}

                            {
                              section
                                .wordBank
                                .join(
                                  ' • '
                                )
                            }

                          </div>

                        )}


                        {Array.isArray(
                          section.questions
                        ) &&
                          section.questions.map(
                            (
                              question,
                              questionIndex
                            ) =>
                              renderQuestion(
                                question,
                                sectionIndex,
                                questionIndex
                              )
                          )}

                      </div>

                    )
                  )}


                  {writingTask
                    ?.enabled ===
                    true && (

                    <div className="exercise-section">

                      <div className="exercise-title-row">

                        <h3>
                          ✍️{' '}
                          {
                            writingTask.title ||
                            'Writing Task'
                          }
                        </h3>

                        {writingTask.suggestedWordCount && (

                          <span className="exercise-badge">
                            {
                              writingTask.suggestedWordCount
                            }
                          </span>

                        )}

                      </div>


                      <p
                        style={{
                          lineHeight:
                            '1.7',
                        }}
                      >
                        {
                          writingTask.instructions
                        }
                      </p>


                      {Array.isArray(
                        writingTask.requiredPoints
                      ) &&
                        writingTask
                          .requiredPoints
                          .length >
                          0 && (

                        <div
                          style={{
                            marginTop:
                              '18px',
                          }}
                        >

                          <strong>
                            Include:
                          </strong>

                          <ul>

                            {
                              writingTask
                                .requiredPoints
                                .map(
                                  (
                                    point,
                                    index
                                  ) => (

                                    <li
                                      key={
                                        index
                                      }
                                    >
                                      {
                                        point
                                      }
                                    </li>

                                  )
                                )
                            }

                          </ul>

                        </div>

                      )}


                      {Array.isArray(
                        writingTask.targetVocabulary
                      ) &&
                        writingTask
                          .targetVocabulary
                          .length >
                          0 && (

                        <div
                          style={{
                            marginTop:
                              '15px',

                            marginBottom:
                              '15px',
                          }}
                        >

                          <strong>
                            Target vocabulary:
                          </strong>{' '}

                          {
                            writingTask
                              .targetVocabulary
                              .join(
                                ', '
                              )
                          }

                        </div>

                      )}


                      <textarea
                        value={
                          writingResponse
                        }
                        onChange={
                          event =>
                            setWritingResponse(
                              event
                                .target
                                .value
                            )
                        }
                        placeholder="Write your response here..."
                        rows="12"
                        style={{
                          width:
                            '100%',

                          padding:
                            '14px',

                          borderRadius:
                            '10px',

                          border:
                            '1px solid #cbd5e1',

                          resize:
                            'vertical',

                          fontFamily:
                            'inherit',

                          fontSize:
                            '15px',

                          lineHeight:
                            '1.6',
                        }}
                      />


                      <div
                        style={{
                          marginTop:
                            '8px',

                          color:
                            '#64748b',

                          fontSize:
                            '13px',
                        }}
                      >
                        Word count:{' '}
                        {
                          writingWordCount
                        }
                      </div>


                      {Array.isArray(
                        writingTask.evaluationCriteria
                      ) &&
                        writingTask
                          .evaluationCriteria
                          .length >
                          0 && (

                        <div
                          style={{
                            marginTop:
                              '18px',

                            padding:
                              '15px',

                            background:
                              '#f8fafc',

                            borderRadius:
                              '10px',
                          }}
                        >

                          <strong>
                            Evaluation criteria
                          </strong>

                          <ul>

                            {
                              writingTask
                                .evaluationCriteria
                                .map(
                                  (
                                    criterion,
                                    index
                                  ) => (

                                    <li
                                      key={
                                        index
                                      }
                                    >
                                      {
                                        criterion
                                      }
                                    </li>

                                  )
                                )
                            }

                          </ul>

                        </div>

                      )}

                    </div>

                  )}


                  <div
                    className="exercise-section"
                    style={{
                      marginTop: '30px',
                      padding: '24px',
                      border: '1px solid #dbeafe',
                      borderRadius: '14px',
                      background: '#f8fbff',
                    }}
                  >
                    <div className="exercise-title-row">
                      <h3>
                        ✅ Submit Homework
                      </h3>

                      <span className="exercise-badge">
                        Full evaluation
                      </span>
                    </div>

                    <p
                      style={{
                        color: '#475569',
                        lineHeight: '1.6',
                      }}
                    >
                      Submit all of your answers together.
                      Exact answers are checked by the
                      application, while meaning-based,
                      open-response and writing tasks are
                      reviewed by AI.
                    </p>

                    <button
                      type="button"
                      onClick={
                        handleSubmitHomework
                      }
                      disabled={
                        isSubmittingHomework
                      }
                      style={{
                        border: 'none',
                        borderRadius: '10px',
                        padding: '13px 22px',
                        background: '#087cff',
                        color: '#ffffff',
                        fontWeight: '700',
                        cursor:
                          isSubmittingHomework
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          isSubmittingHomework
                            ? 0.65
                            : 1,
                      }}
                    >
                      {isSubmittingHomework
                        ? 'Evaluating...'
                        : 'Submit Homework'}
                    </button>

                    {evaluationStatus && (
                      <div
                        style={{
                          marginTop: '14px',
                          fontWeight: '700',
                          color:
                            evaluationStatus
                              .toLowerCase()
                              .includes(
                                'failed'
                              ) ||
                            evaluationStatus
                              .toLowerCase()
                              .includes(
                                'cannot'
                              )
                              ? '#d63b3b'
                              : '#168447',
                        }}
                      >
                        {evaluationStatus}
                      </div>
                    )}
                  </div>


                  {evaluationResult && (
                    <div
                      id="evaluation-report"
                      className="exercise-section"
                      style={{
                        marginTop: '30px',
                        padding: '24px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '14px',
                        background: '#ffffff',
                      }}
                    >
                      <div className="exercise-title-row">
                        <h3>
                          📊 Homework Report
                        </h3>

                        <span className="exercise-badge">
                          EVALUATED
                        </span>
                      </div>


                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '12px',
                          marginTop: '20px',
                          marginBottom: '24px',
                        }}
                      >
                        <div
                          style={{
                            padding: '18px',
                            borderRadius: '12px',
                            background: '#eef6ff',
                          }}
                        >
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '13px',
                            }}
                          >
                            Overall Score
                          </div>

                          <div
                            style={{
                              fontSize: '30px',
                              fontWeight: '800',
                              marginTop: '4px',
                            }}
                          >
                            {evaluationResult
                              ?.summary
                              ?.overallScore ??
                              0}%
                          </div>
                        </div>


                        <div
                          style={{
                            padding: '18px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                          }}
                        >
                          <div
                            style={{
                              color: '#64748b',
                              fontSize: '13px',
                            }}
                          >
                            Questions
                          </div>

                          <div
                            style={{
                              fontSize: '30px',
                              fontWeight: '800',
                              marginTop: '4px',
                            }}
                          >
                            {evaluationResult
                              ?.summary
                              ?.questionScore ??
                              0}%
                          </div>
                        </div>


                        {evaluationResult
                          ?.writingResult
                          ?.enabled ===
                          true && (

                          <div
                            style={{
                              padding: '18px',
                              borderRadius: '12px',
                              background: '#f8fafc',
                            }}
                          >
                            <div
                              style={{
                                color: '#64748b',
                                fontSize: '13px',
                              }}
                            >
                              Writing
                            </div>

                            <div
                              style={{
                                fontSize: '30px',
                                fontWeight: '800',
                                marginTop: '4px',
                              }}
                            >
                              {evaluationResult
                                .writingResult
                                .score ??
                                0}%
                            </div>
                          </div>

                        )}
                      </div>


                      {sectionScoreRows.length >
                        0 && (

                        <div
                          style={{
                            marginBottom: '26px',
                          }}
                        >
                          <h4>
                            Section Scores
                          </h4>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: '10px',
                            }}
                          >
                            {sectionScoreRows.map(
                              item => (
                                <div
                                  key={
                                    item.sectionId
                                  }
                                  style={{
                                    padding: '14px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    background: '#f8fafc',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: '700',
                                      marginBottom: '6px',
                                    }}
                                  >
                                    {item.title}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: '24px',
                                      fontWeight: '800',
                                    }}
                                  >
                                    {item.score}%
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                      )}


                      {evaluationResult
                        ?.writingResult
                        ?.enabled ===
                        true &&
                        evaluationResult
                          ?.writingResult
                          ?.submitted ===
                          true && (

                        <div
                          style={{
                            marginBottom: '28px',
                            padding: '18px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                          }}
                        >
                          <h4>
                            Writing Evaluation
                          </h4>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(145px, 1fr))',
                              gap: '8px',
                              marginBottom: '16px',
                            }}
                          >
                            {Object.entries(
                              evaluationResult
                                .writingResult
                                .criteria ||
                                {}
                            ).map(
                              ([
                                criterion,
                                score,
                              ]) => (
                                <div
                                  key={
                                    criterion
                                  }
                                  style={{
                                    padding: '10px',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '9px',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: '12px',
                                      color: '#64748b',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {criterion}
                                  </div>

                                  <strong>
                                    {score}/20
                                  </strong>
                                </div>
                              )
                            )}
                          </div>

                          {evaluationResult
                            .writingResult
                            .feedback && (

                            <p
                              style={{
                                lineHeight: '1.7',
                              }}
                            >
                              {evaluationResult
                                .writingResult
                                .feedback}
                            </p>

                          )}
                        </div>

                      )}


                      {Array.isArray(
                        evaluationResult
                          ?.report
                          ?.strengths
                      ) &&
                        evaluationResult
                          .report
                          .strengths
                          .length > 0 && (

                        <div
                          style={{
                            marginBottom: '20px',
                          }}
                        >
                          <h4>
                            Strengths
                          </h4>

                          <ul>
                            {evaluationResult
                              .report
                              .strengths
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                          </ul>
                        </div>

                      )}


                      {Array.isArray(
                        evaluationResult
                          ?.report
                          ?.improvements
                      ) &&
                        evaluationResult
                          .report
                          .improvements
                          .length > 0 && (

                        <div
                          style={{
                            marginBottom: '20px',
                          }}
                        >
                          <h4>
                            Needs Improvement
                          </h4>

                          <ul>
                            {evaluationResult
                              .report
                              .improvements
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                          </ul>
                        </div>

                      )}


                      {evaluationResult
                        ?.report
                        ?.teacherComment && (

                        <div
                          style={{
                            marginBottom: '26px',
                            padding: '18px',
                            borderRadius: '12px',
                            background: '#eef6ff',
                            lineHeight: '1.7',
                          }}
                        >
                          <h4
                            style={{
                              marginTop: 0,
                            }}
                          >
                            Teacher Feedback
                          </h4>

                          <p
                            style={{
                              marginBottom: 0,
                            }}
                          >
                            {evaluationResult
                              .report
                              .teacherComment}
                          </p>
                        </div>

                      )}


                      {sortedEvaluationResults.length >
                        0 && (

                        <div>
                          <h4>
                            Question Feedback
                          </h4>

                          {sortedEvaluationResults.map(
                            (result, index) => {
                              const found =
                                findQuestionForResult(
                                  result
                                )

                              return (
                                <div
                                  key={
                                    String(
                                      result.sectionId
                                    ) +
                                    '-' +
                                    String(
                                      result.questionId
                                    ) +
                                    '-' +
                                    index
                                  }
                                  style={{
                                    marginBottom: '12px',
                                    padding: '15px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    background: '#f8fafc',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      gap: '10px',
                                      flexWrap: 'wrap',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    <strong>
                                      {found.section
                                        ?.title ||
                                        'Section ' +
                                          result.sectionId}
                                      {' — '}
                                      Question{' '}
                                      {result.questionId}
                                    </strong>

                                    <span
                                      className="exercise-badge"
                                    >
                                      {result.score}/
                                      {result.maxScore}
                                    </span>
                                  </div>

                                  {found.question
                                    ?.question && (

                                    <div
                                      style={{
                                        marginBottom: '8px',
                                        color: '#334155',
                                      }}
                                    >
                                      {found.question
                                        .question}
                                    </div>

                                  )}

                                  {result.feedback && (
                                    <div
                                      style={{
                                        color: '#475569',
                                        lineHeight: '1.6',
                                      }}
                                    >
                                      {result.feedback}
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          )}
                        </div>

                      )}


                      {evaluationResult
                        ?.model && (

                        <div
                          style={{
                            marginTop: '20px',
                            fontSize: '12px',
                            color: '#94a3b8',
                          }}
                        >
                          AI evaluator:{' '}
                          {evaluationResult.model}
                        </div>

                      )}
                    </div>

                  )}

                </>
              )}


              {!hasNewHomework &&
                legacyMcq.length >
                  0 && (

                <div className="exercise-section">

                  <div className="exercise-title-row">

                    <h3>
                      Multiple Choice
                    </h3>

                    <span className="exercise-badge">
                      {
                        legacyMcq.length
                      }{' '}
                      Questions
                    </span>

                  </div>


                  {legacyMcq.map(
                    (
                      exercise,
                      index
                    ) => {

                      const key =
                        'legacy-mcq-' +
                        index

                      return (

                        <div
                          className="question-card"
                          key={
                            key
                          }
                        >

                          <div className="question-number">
                            Question{' '}
                            {
                              index +
                              1
                            }
                          </div>

                          <h4>
                            {
                              exercise.question
                            }
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
                                        key
                                      }
                                      checked={
                                        answers[
                                          key
                                        ] ===
                                        option
                                      }
                                      onChange={() =>
                                        handleChoiceAnswer(
                                          key,
                                          option,
                                          {
                                            ...exercise,
                                            evaluationMode:
                                              'exact',
                                          }
                                        )
                                      }
                                    />

                                    <span>
                                      {
                                        option
                                      }
                                    </span>

                                  </label>

                                )
                              )}

                          </div>

                          {renderFeedback(
                            key
                          )}

                        </div>

                      )
                    }
                  )}

                </div>

              )}


              {!hasNewHomework &&
                legacyFill.length >
                  0 && (

                <div className="exercise-section">

                  <div className="exercise-title-row">

                    <h3>
                      Fill in the Blank
                    </h3>

                    <span className="exercise-badge">
                      {
                        legacyFill.length
                      }{' '}
                      Questions
                    </span>

                  </div>


                  {legacyFill.map(
                    (
                      exercise,
                      index
                    ) => {

                      const key =
                        'legacy-fill-' +
                        index

                      return (

                        <div
                          className="question-card"
                          key={
                            key
                          }
                        >

                          <div className="question-number">
                            Question{' '}
                            {
                              index +
                              1
                            }
                          </div>

                          <h4>
                            {
                              exercise.question
                            }
                          </h4>


                          <div className="fill-answer-area">

                            <input
                              type="text"
                              placeholder="Type your answer"
                              value={
                                answers[
                                  key
                                ] ||
                                ''
                              }
                              onChange={
                                event =>
                                  handleTextChange(
                                    key,
                                    event
                                      .target
                                      .value
                                  )
                              }
                            />


                            <button
                              type="button"
                              onClick={() =>
                                checkTextAnswer(
                                  key,
                                  {
                                    ...exercise,

                                    acceptedAnswers:
                                      [],

                                    evaluationMode:
                                      'exact',
                                  }
                                )
                              }
                              style={{
                                marginTop:
                                  '10px',

                                border:
                                  'none',

                                borderRadius:
                                  '9px',

                                padding:
                                  '10px 18px',

                                background:
                                  '#087cff',

                                color:
                                  '#ffffff',

                                fontWeight:
                                  '700',

                                cursor:
                                  'pointer',
                              }}
                            >
                              Check Answer
                            </button>

                            {renderFeedback(
                              key
                            )}

                          </div>

                        </div>

                      )
                    }
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
                <span>
                  1
                </span>
                Upload your PDF
              </div>

              <div className="mini-step">
                <span>
                  2
                </span>
                AI analyses the lesson
              </div>

              <div className="mini-step">
                <span>
                  3
                </span>
                Complete your homework
              </div>

            </section>


            <section className="side-card">

              <h3>
                Tips for Better Results
              </h3>

              <p>
                ✓ Use clear,
                text-based PDFs.
              </p>

              <p>
                ✓ Lessons with useful
                target language work best.
              </p>

              <p>
                ✓ Longer lessons can
                create more varied
                practice.
              </p>

              <p>
                ✓ Complete the sections
                in order for best results.
              </p>

            </section>


            <section className="side-card quote-card">

              <div className="quote-mark">
                “
              </div>

              <p>
                A new language is a
                new way of seeing the
                world.
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
                <strong>
                  AWS
                </strong>

                <span>
                  SOLUTIONS
                </span>
              </div>

            </div>

            <p>
              Building secure,
              scalable solutions
              for a better tomorrow.
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