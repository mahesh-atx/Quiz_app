/**
 * Quiz Taking Logic
 * Handles quiz flow, timer, and submission
 */

let currentQuiz = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = new Map(); // questionId -> selectedOptionIndex
let timerInterval = null;
let secondsRemaining = 0;
let isStudent = false;
let studentProfile = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('id');
    isStudent = urlParams.get('student') === 'true';

    if (!quizId) {
        alert('No quiz specified');
        window.location.href = '/';
        return;
    }

    if (isStudent) {
        // Load student profile from local storage
        try {
            const storedProfile = localStorage.getItem('studentProfile');
            if (!storedProfile) {
                // If no profile found, redirect to join page
                window.location.href = `/join-quiz.html?code=${urlParams.get('code') || ''}`;
                return;
            }
            studentProfile = JSON.parse(storedProfile);
            
            // verify this profile matches the quiz
            if (studentProfile.quizId !== quizId) {
                 // Profile is for a different quiz, maybe show a warning or clear it?
                 // For now, let's assume one session at a time
            }

            document.getElementById('navStudentName').textContent = studentProfile.name;

        } catch (e) {
            console.error('Error loading student profile', e);
            window.location.href = '/join-quiz.html';
            return;
        }
    } else {
        // TODO: Handle authenticated user check
        // For now, we'll assume logged in or rely on API 401s
    }

    await loadQuiz(quizId);
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', startQuiz);
    document.getElementById('prevBtn').addEventListener('click', prevQuestion);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.getElementById('submitBtn').addEventListener('click', submitQuiz);
}

/**
 * Load quiz data
 */
async function loadQuiz(quizId) {
    try {
        let url = `/api/quizzes/${quizId}`;
        
        // If student, we might need a different endpoint that doesn't require auth 
        // OR rely on the fact that some quiz info is public?
        // Actually, for taking the quiz, we need the questions.
        // Protected quizzes usually require auth.
        // We probably need a public "start quiz" endpoint for students that validates the student ID/Access Code
        
        // For now let's use the public `getQuizByCode` logic or similar if it returns questions?
        // Wait, `getQuizByCode` (implemented earlier) DOES NOT return questions to prevent cheating before start.
        
        // We need an endpoint to "start" the quiz which returns the questions.
        // Let's try the standard endpoint. If it fails (401), we need a specific student endpoint.
        // Since I haven't implemented a specific `GET /api/students/quiz/:id/start` yet, 
        // I might run into an issue here if the standard endpoint is protected.
        
        // Checking `server/routes/quiz.js`:
        // `router.get('/:id', quizController.getQuizById);` is PUBLIC! (Line 11 in original file)
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load quiz');
        }

        currentQuiz = data.quiz;
        currentQuestions = currentQuiz.questions;

        renderStartScreen();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');

    } catch (error) {
        console.error('Load quiz error:', error);
        document.getElementById('loading').innerHTML = `
            <div class="text-red-400 mb-4"><i data-lucide="alert-circle" class="w-12 h-12 mx-auto"></i></div>
            <p class="text-red-400">${error.message}</p>
            <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-zinc-800 rounded-lg">Retry</button>
        `;
        lucide.createIcons();
    }
}

function renderStartScreen() {
    document.getElementById('navQuizTitle').textContent = currentQuiz.title;
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    document.getElementById('quizDescription').textContent = currentQuiz.description || 'No description provided';
    document.getElementById('questionCount').textContent = currentQuestions.length;
    document.getElementById('timeLimit').textContent = currentQuiz.timeLimit + 'm';
    document.getElementById('passPercentage').textContent = currentQuiz.passPercentage + '%';
    
    // Icon
    const iconName = currentQuiz.category?.icon || 'book-open';
    const iconContainer = document.querySelector('#quizIcon').parentElement;
    iconContainer.innerHTML = `<i data-lucide="${iconName}" class="w-10 h-10 text-brand-400"></i>`;
    lucide.createIcons();
}

function startQuiz() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('questionScreen').classList.remove('hidden');
    
    // Start timer
    secondsRemaining = currentQuiz.timeLimit * 60;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        secondsRemaining--;
        updateTimerDisplay();
        
        if (secondsRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up! Submitting your answers.');
            submitQuiz();
        }
    }, 1000);

    renderQuestion();
}

function updateTimerDisplay() {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer').textContent = display;
    
    // Visual warning
    if (secondsRemaining < 60) {
        document.getElementById('timerContainer').classList.add('border-red-500', 'text-red-500');
        document.getElementById('timerContainer').classList.remove('border-zinc-800');
    }
}

function renderQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    
    // Update progress
    document.getElementById('currentQuestionNum').textContent = currentQuestionIndex + 1;
    document.getElementById('totalQuestionsNum').textContent = currentQuestions.length;
    
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;

    // Render text
    document.getElementById('questionText').textContent = question.questionText;
    
    // Render options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const isSelected = userAnswers.get(question._id) === index;
        
        const btn = document.createElement('button');
        btn.className = `w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
            isSelected 
                ? 'border-brand-500 bg-brand-500/10' 
                : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800'
        }`;
        
        btn.innerHTML = `
            <span class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    isSelected ? 'bg-brand-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
                }">${String.fromCharCode(65 + index)}</span>
                <span class="${isSelected ? 'text-white' : 'text-zinc-300'}">${option.text}</span>
            </span>
            ${isSelected ? '<i data-lucide="check-circle" class="w-5 h-5 text-brand-500"></i>' : ''}
        `;
        
        btn.onclick = () => selectOption(question._id, index);
        optionsContainer.appendChild(btn);
    });
    
    lucide.createIcons();

    // Update buttons
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;
    
    const isLast = currentQuestionIndex === currentQuestions.length - 1;
    if (isLast) {
        document.getElementById('nextBtn').classList.add('hidden');
        document.getElementById('submitBtn').classList.remove('hidden');
    } else {
        document.getElementById('nextBtn').classList.remove('hidden');
        document.getElementById('submitBtn').classList.add('hidden');
    }
}

function selectOption(questionId, optionIndex) {
    userAnswers.set(questionId, optionIndex);
    renderQuestion(); // Re-render to show selection
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

async function submitQuiz() {
    clearInterval(timerInterval);
    
    // Show loading
    document.getElementById('questionScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    
    // Prepare payload
    const answers = [];
    userAnswers.forEach((selectedOption, questionId) => {
        answers.push({
            questionId: questionId,
            selectedOption: selectedOption
        });
    });
    
    const payload = {
        quizId: currentQuiz._id,
        answers: answers,
        timeTaken: (currentQuiz.timeLimit * 60) - secondsRemaining
    };
    
    if (isStudent) {
        payload.studentId = studentProfile._id;
        payload.participantType = 'student';
    } else {
        payload.participantType = 'user';
    }
    
    try {
        const response = await fetch('/api/results/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Submission failed');
        }
        
        // Redirect to results page
        setTimeout(() => {
             if (isStudent) {
                 window.location.href = `/student-result.html?id=${data.resultId}`;
             } else {
                 window.location.href = `/results.html?id=${data.resultId}`;
             }
        }, 1500);
        
    } catch (error) {
        console.error('Submission error:', error);
        alert('Failed to submit quiz: ' + error.message);
        document.getElementById('resultScreen').classList.add('hidden');
        document.getElementById('questionScreen').classList.remove('hidden');
    }
}
