require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !JWT_SECRET) {
  console.error("Missing environment variables: SUPABASE_URL, SUPABASE_KEY, or JWT_SECRET");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseStorage = require('@supabase/supabase-js').createClient(supabaseUrl, supabaseKey);

const authenticateToken = require('./User/middleware/authenticateToken.js')

const imageRoutes = require('./User/Instrument/Imageinstrument')(supabase);
const audioRoutes = require('./User/Instrument/Audioinstrument')(supabase);
const componentMediaRoutes = require('./User/Instrument/ComponentMedia')(supabase);
const loginRoutes = require('./User/Home/Login')(supabase);
const registerRoutes = require('./User/Home/Register')(supabase);
const getUserRoutes = require('./User/Profile/UserProfile')(supabase);
const updateProfileRoutes = require('./User/Profile/UpdateProfile')(supabase);
const userLevelsRoutes = require('./User/Profile/UserLevels')(supabase);
const checkEmailRoutes = require('./User/Resetpassword/CheckEmail')(supabase);
const resetPasswordRoutes = require('./User/Resetpassword/ResetPassword')(supabase);
const sendotpRoutes = require('./User/Otp/SendOtp')(supabase);
const verifyRoutes = require('./User/Otp/VerifyOtp')(supabase);
const submitPretestRoutes = require('./User/Pretest/SubmitPretest')(supabase, authenticateToken);
const userHistoryRoute = require('./User/TestHistory/Userhistory')(supabase);
const answerTextRoutes = require('./User/Pretest/AnswerText.js')(supabase); 
const LearningRoutes = require('./User/Learning/InstrumentLearning')(supabase);
const pretestStatusRoutes = require('./User/Pretest/PretestStatus')(supabase, authenticateToken);
const newTestNotificationRoutes = require('./User/Pretest/NewTestNotification')(supabase, authenticateToken);

// Posttest Routes
const posttestControllerRoutes = require('./User/Posttest/PosttestController')(supabase);
const posttestStatusRoutes = require('./User/Posttest/PosttestStatus')(supabase, authenticateToken);
const submitPosttestRoutes = require('./User/Posttest/SubmitPosttest')(supabase, authenticateToken);

// Level Test Routes - REMOVED (unused)

// Level Test One Routes
const levelTestOneRoutes = require('./User/LevelTestOne/LevelTestOneController.js')(supabase);
const levelTestOneAnswerTextRoutes = require('./User/LevelTestOne/LevelTestOneAnswerText.js')(supabase);
const submitLevelTestOneRoutes = require('./User/LevelTestOne/SubmitLevelTestOne.js')(supabase, authenticateToken);
const levelTestOneStatusRoutes = require('./User/LevelTestOne/LevelTestOneStatus.js')(supabase, authenticateToken);

// Level Test Two Routes
const levelTestTwoRoutes = require('./User/LevelTestTwo/LevelTestTwoController.js')(supabase);
const levelTestTwoAnswerTextRoutes = require('./User/LevelTestTwo/LevelTestTwoAnswerText.js')(supabase);
const submitLevelTestTwoRoutes = require('./User/LevelTestTwo/SubmitLevelTestTwo.js')(supabase, authenticateToken);
const levelTestTwoStatusRoutes = require('./User/LevelTestTwo/LevelTestTwoStatus.js')(supabase, authenticateToken);

// Level Test Three Routes
const levelTestThreeRoutes = require('./User/LevelTestThree/LevelTestThreeController.js')(supabase);
const levelTestThreeAnswerTextRoutes = require('./User/LevelTestThree/LevelTestThreeAnswerText.js')(supabase, authenticateToken);
const submitLevelTestThreeRoutes = require('./User/LevelTestThree/SubmitLevelTestThree.js')(supabase, authenticateToken);
const levelTestThreeStatusRoutes = require('./User/LevelTestThree/LevelTestThreeStatus.js')(supabase, authenticateToken);

// Level Test All Routes - REMOVED (unused)

// Test Requirement Routes
const testRequirementRoutes = require('./User/TestRequirement/TestRequirementController.js')(supabase);
const posttestAnswerTextNewRoutes = require('./User/Posttest/PosttestAnswerText')(supabase, authenticateToken);

const userControllerRoutes = require('./Admin/UserController')(supabase);
const adminTestRequirementRoutes = require('./Admin/TestRequirementController')(supabase);
const instrumentControllerRoutes = require('./Admin/InstrumentController')(supabase, supabaseStorage);
const componentMediaControllerRoutes = require('./Admin/ComponentMediaController')(supabase, supabaseStorage);
const quizzControllerRoutes = require('./Admin/QuizzController')(supabase);
const audioControllerRoutes = require('./Admin/AudioController')(supabase, supabaseStorage);
const questionTextControllerRoutes = require('./Admin/QuestionTextController')(supabase);
const answerControllerRoutes = require('./Admin/AnswerController')(supabase);
const learningControllerRoutes = require('./Admin/LearningController')(supabase);
const learningMediaControllerRoutes = require('./Admin/LearningMediaController')(supabase, supabaseStorage);
const questionMediaControllerRoutes = require('./Admin/QuestionMediaController')(supabase, supabaseStorage);
const AnswerController = require('./Admin/AnswerController.js'); // จะเปลี่ยนชื่อไฟล์หลังสร้างจริง  
const userAnswerControllerRoutes = require('./Admin/UserAnswerController')(supabase);
const userUnlockRoutes = require('./User/UserUnlock/UserUnlockController')(supabase);
const userLevelControllerRoutes = require('./Admin/UserLevelController')(supabase);
const levelTestOneScoreControllerRoutes = require('./Admin/LevelTestOneScoreController')(supabase);


// --- Use Routes ---
app.use('/instruments', imageRoutes);
app.use('/audio', audioRoutes);
app.use('/auth', componentMediaRoutes);
app.use('/auth', loginRoutes);
app.use('/auth', registerRoutes);
app.use('/auth', getUserRoutes);
app.use('/auth', updateProfileRoutes);
app.use('/api', userLevelsRoutes);
app.use('/auth', resetPasswordRoutes);
app.use('/auth', sendotpRoutes);
app.use('/auth', verifyRoutes);
app.use('/auth', checkEmailRoutes);
app.use('/api', userHistoryRoute);
app.use('/api', answerTextRoutes); 
app.use('/api', submitPretestRoutes);
app.use('/api', LearningRoutes);
app.use('/api', pretestStatusRoutes);
app.use('/api', newTestNotificationRoutes);
// Posttest Routes
app.use('/api', posttestControllerRoutes);
app.use('/api', posttestStatusRoutes);
app.use('/api', submitPosttestRoutes);
app.use('/api', posttestAnswerTextNewRoutes);

// Level Test Routes - REMOVED (unused)

// Level Test One Routes
app.use('/api', levelTestOneRoutes);
app.use('/api', levelTestOneAnswerTextRoutes);
app.use('/api', submitLevelTestOneRoutes);
app.use('/api', levelTestOneStatusRoutes);

// Level Test Two Routes
app.use('/api', levelTestTwoRoutes);
app.use('/api', levelTestTwoAnswerTextRoutes);
app.use('/api', submitLevelTestTwoRoutes);
app.use('/api', levelTestTwoStatusRoutes);

// Level Test Three Routes
app.use('/api', levelTestThreeRoutes);
app.use('/api', levelTestThreeAnswerTextRoutes);
app.use('/api', submitLevelTestThreeRoutes);
app.use('/api', levelTestThreeStatusRoutes);

// Level Test All Routes - REMOVED (unused)

// Test Requirement Routes
app.use('/api', testRequirementRoutes);
app.use('/admin', userControllerRoutes);
app.use('/admin', adminTestRequirementRoutes);
app.use('/admin', instrumentControllerRoutes);
app.use('/admin', componentMediaControllerRoutes);
app.use('/admin', quizzControllerRoutes);
app.use('/admin', audioControllerRoutes);
app.use('/admin', questionTextControllerRoutes);
app.use('/admin', answerControllerRoutes);
app.use('/admin', learningControllerRoutes);
app.use('/admin', learningMediaControllerRoutes);
app.use('/admin', questionMediaControllerRoutes);
app.use('/admin', userAnswerControllerRoutes);
app.use('/api', userUnlockRoutes);
app.use('/admin/user-levels', userLevelControllerRoutes);
app.use('/admin', levelTestOneScoreControllerRoutes);


app.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});