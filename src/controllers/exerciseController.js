// @desc    Get all exercises (with filters)
exports.getExercises = async (req, res, next) => {
  try {
    const { muscle, equipment, difficulty, search, page = 1, limit = 20 } = req.query;
    let results = EXERCISE_DATABASE;

    if (muscle) results = results.filter(e => e.muscle === muscle || e.secondaryMuscles?.includes(muscle));
    if (equipment) results = results.filter(e => e.equipment === equipment);
    if (difficulty) results = results.filter(e => e.difficulty === difficulty);
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
    }

    const total = results.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    results = results.slice(skip, skip + parseInt(limit));

    res.json({ success: true, count: results.length, total, pages: Math.ceil(total / parseInt(limit)), data: results });
  } catch (error) {
    next(error);
  }
};

// @desc    Get exercise by ID
exports.getExerciseById = async (req, res, next) => {
  try {
    const exercise = EXERCISE_DATABASE.find(e => e.id === parseInt(req.params.id));
    if (!exercise) return res.status(404).json({ success: false, message: 'Exercise not found' });
    res.json({ success: true, data: exercise });
  } catch (error) {
    next(error);
  }
};

// @desc    Get exercises by muscle group
exports.getByMuscle = async (req, res, next) => {
  try {
    const exercises = EXERCISE_DATABASE.filter(e => e.muscle === req.params.muscle || e.secondaryMuscles?.includes(req.params.muscle));
    res.json({ success: true, count: exercises.length, data: exercises });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available muscle groups
exports.getMuscleGroups = async (req, res, next) => {
  try {
    const muscles = [...new Set(EXERCISE_DATABASE.map(e => e.muscle))];
    const data = muscles.map(m => ({ name: m, count: EXERCISE_DATABASE.filter(e => e.muscle === m).length }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const EXERCISE_DATABASE = [
  // === CHEST ===
  { id: 1, name: 'Flat Barbell Bench Press', muscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'barbell', difficulty: 'intermediate', sets: '4', reps: '8-12', instructions: 'Lie on flat bench, grip barbell shoulder-width apart. Lower bar to mid-chest, press up explosively. Keep feet flat on floor, slight arch in lower back.', tips: 'Focus on squeezing chest at top. Don\'t bounce the bar off your chest.', calories_per_set: 8 },
  { id: 2, name: 'Incline Dumbbell Press', muscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'dumbbell', difficulty: 'intermediate', sets: '3', reps: '10-12', instructions: 'Set bench to 30-45 degrees. Press dumbbells up from shoulder level, bringing them together at top. Lower slowly.', tips: 'Great for upper chest development. Don\'t go too steep with the incline.', calories_per_set: 7 },
  { id: 3, name: 'Push-ups', muscle: 'chest', secondaryMuscles: ['triceps', 'shoulders', 'core'], equipment: 'bodyweight', difficulty: 'beginner', sets: '4', reps: '15-20', instructions: 'Hands shoulder-width apart, body in a straight line. Lower chest to the floor, push back up. Keep core tight throughout.', tips: 'The foundation of chest training. Modify on knees if needed.', calories_per_set: 5 },
  { id: 4, name: 'Cable Flyes', muscle: 'chest', secondaryMuscles: ['shoulders'], equipment: 'cable', difficulty: 'intermediate', sets: '3', reps: '12-15', instructions: 'Stand between cable towers, grab handles. With slight bend in elbows, bring hands together in front of chest in a hugging motion.', tips: 'Constant tension throughout the movement. Squeeze chest hard at the top.', calories_per_set: 6 },
  { id: 5, name: 'Dips (Chest)', muscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'bodyweight', difficulty: 'intermediate', sets: '3', reps: '10-15', instructions: 'Lean forward slightly on dip bars. Lower body until upper arms are parallel to floor. Press back up.', tips: 'Leaning forward targets chest more. Stay upright to target triceps.', calories_per_set: 7 },

  // === BACK ===
  { id: 6, name: 'Pull-ups', muscle: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'bodyweight', difficulty: 'intermediate', sets: '4', reps: '8-12', instructions: 'Hang from bar with overhand grip, shoulder-width apart. Pull yourself up until chin clears bar. Lower slowly.', tips: 'The king of back exercises. Use assisted machine if you can\'t do full reps.', calories_per_set: 8 },
  { id: 7, name: 'Barbell Rows', muscle: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'barbell', difficulty: 'intermediate', sets: '4', reps: '8-12', instructions: 'Bend at hips 45 degrees, grip barbell. Pull bar to lower chest/upper abs. Squeeze shoulder blades together.', tips: 'Keep your back flat. Don\'t use momentum.', calories_per_set: 9 },
  { id: 8, name: 'Lat Pulldown', muscle: 'back', secondaryMuscles: ['biceps'], equipment: 'cable', difficulty: 'beginner', sets: '3', reps: '10-12', instructions: 'Sit at lat pulldown machine. Grip bar wide, pull down to upper chest. Control the weight back up.', tips: 'Think about pulling with your elbows, not your hands.', calories_per_set: 6 },
  { id: 9, name: 'Deadlift', muscle: 'back', secondaryMuscles: ['hamstrings', 'glutes', 'core', 'forearms'], equipment: 'barbell', difficulty: 'advanced', sets: '4', reps: '5-8', instructions: 'Stand with feet hip-width, grip bar outside knees. Drive through heels, extend hips and knees simultaneously. Stand tall at top.', tips: 'Most important exercise for overall strength. Keep the bar close to your body.', calories_per_set: 12 },
  { id: 10, name: 'Seated Cable Row', muscle: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'cable', difficulty: 'beginner', sets: '3', reps: '10-12', instructions: 'Sit at cable row machine, grip handle. Pull toward lower chest, squeezing shoulder blades. Return slowly.', tips: 'Don\'t lean too far back. Keep torso stationary.', calories_per_set: 6 },

  // === LEGS ===
  { id: 11, name: 'Barbell Squat', muscle: 'legs', secondaryMuscles: ['glutes', 'core'], equipment: 'barbell', difficulty: 'intermediate', sets: '4', reps: '8-12', instructions: 'Bar on upper back, feet shoulder-width. Sit back and down until thighs are parallel to floor. Drive up through heels.', tips: 'King of leg exercises. Keep chest up and knees tracking over toes.', calories_per_set: 12 },
  { id: 12, name: 'Leg Press', muscle: 'legs', secondaryMuscles: ['glutes'], equipment: 'machine', difficulty: 'beginner', sets: '4', reps: '10-15', instructions: 'Sit in leg press machine, feet shoulder-width on platform. Lower weight until knees are at 90 degrees. Press back up.', tips: 'Don\'t lock out knees at top. Control the negative.', calories_per_set: 10 },
  { id: 13, name: 'Romanian Deadlift', muscle: 'legs', secondaryMuscles: ['back', 'glutes'], equipment: 'barbell', difficulty: 'intermediate', sets: '3', reps: '10-12', instructions: 'Hold barbell, slight knee bend. Hinge at hips, lower bar along legs until you feel a hamstring stretch. Return to standing.', tips: 'Best hamstring exercise. Feel the stretch, don\'t round your back.', calories_per_set: 9 },
  { id: 14, name: 'Lunges', muscle: 'legs', secondaryMuscles: ['glutes', 'core'], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '12 each leg', instructions: 'Step forward, lower back knee toward floor. Front knee at 90 degrees. Push back to starting position.', tips: 'Keep torso upright. Add dumbbells for extra challenge.', calories_per_set: 7 },
  { id: 15, name: 'Bodyweight Squats', muscle: 'legs', secondaryMuscles: ['glutes', 'core'], equipment: 'bodyweight', difficulty: 'beginner', sets: '4', reps: '20-25', instructions: 'Feet shoulder-width, toes slightly out. Sit back and down, keeping chest up. Stand back up.', tips: 'Perfect for home workouts and beginners. Focus on depth and form.', calories_per_set: 6 },

  // === SHOULDERS ===
  { id: 16, name: 'Overhead Press', muscle: 'shoulders', secondaryMuscles: ['triceps', 'core'], equipment: 'barbell', difficulty: 'intermediate', sets: '4', reps: '8-10', instructions: 'Stand with barbell at shoulder level. Press overhead until arms are fully extended. Lower back to shoulders.', tips: 'Best compound shoulder exercise. Brace your core throughout.', calories_per_set: 8 },
  { id: 17, name: 'Lateral Raises', muscle: 'shoulders', secondaryMuscles: [], equipment: 'dumbbell', difficulty: 'beginner', sets: '4', reps: '12-15', instructions: 'Hold dumbbells at sides. Raise arms out to sides until parallel with floor. Lower slowly.', tips: 'Use lighter weight with strict form. Lead with your elbows.', calories_per_set: 5 },
  { id: 18, name: 'Face Pulls', muscle: 'shoulders', secondaryMuscles: ['back'], equipment: 'cable', difficulty: 'beginner', sets: '3', reps: '15-20', instructions: 'Set cable at face height. Pull rope toward face, separating hands. Squeeze rear delts at the end.', tips: 'Essential for shoulder health and posture. Do these every workout.', calories_per_set: 4 },

  // === ARMS ===
  { id: 19, name: 'Barbell Bicep Curl', muscle: 'biceps', secondaryMuscles: ['forearms'], equipment: 'barbell', difficulty: 'beginner', sets: '3', reps: '10-12', instructions: 'Stand with barbell, underhand grip. Curl weight up by flexing biceps. Lower slowly.', tips: 'Don\'t swing. Keep elbows pinned to your sides.', calories_per_set: 5 },
  { id: 20, name: 'Tricep Pushdown', muscle: 'triceps', secondaryMuscles: [], equipment: 'cable', difficulty: 'beginner', sets: '3', reps: '12-15', instructions: 'Stand at cable machine, grip bar overhand. Push bar down until arms are fully extended. Return slowly.', tips: 'Keep elbows tucked. Only move your forearms.', calories_per_set: 4 },
  { id: 21, name: 'Hammer Curls', muscle: 'biceps', secondaryMuscles: ['forearms'], equipment: 'dumbbell', difficulty: 'beginner', sets: '3', reps: '10-12', instructions: 'Hold dumbbells with palms facing each other. Curl up, keeping palms facing in throughout.', tips: 'Targets brachialis for thicker arms. Great for forearm development too.', calories_per_set: 5 },
  { id: 22, name: 'Skull Crushers', muscle: 'triceps', secondaryMuscles: [], equipment: 'barbell', difficulty: 'intermediate', sets: '3', reps: '10-12', instructions: 'Lie on bench, hold EZ bar above chest. Lower bar toward forehead by bending elbows. Extend back up.', tips: 'Best tricep mass builder. Don\'t flare your elbows.', calories_per_set: 5 },

  // === ABS ===
  { id: 23, name: 'Crunches', muscle: 'abs', secondaryMuscles: [], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '20-25', instructions: 'Lie on back, knees bent. Curl upper body toward knees, lifting shoulder blades off floor. Lower slowly.', tips: 'Don\'t pull on your neck. Focus on contracting abs.', calories_per_set: 4 },
  { id: 24, name: 'Plank', muscle: 'abs', secondaryMuscles: ['shoulders', 'back'], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '30-60 seconds', instructions: 'Forearms and toes on floor, body in a straight line. Hold position. Don\'t let hips sag or pike.', tips: 'Best core stability exercise. Squeeze your glutes and brace your core.', calories_per_set: 5 },
  { id: 25, name: 'Hanging Leg Raise', muscle: 'abs', secondaryMuscles: ['hip_flexors'], equipment: 'bodyweight', difficulty: 'advanced', sets: '3', reps: '10-15', instructions: 'Hang from pull-up bar. Raise legs until they\'re parallel with floor or higher. Lower with control.', tips: 'Best lower ab exercise. Avoid swinging.', calories_per_set: 6 },
  { id: 26, name: 'Mountain Climbers', muscle: 'abs', secondaryMuscles: ['shoulders', 'legs'], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '30 seconds', instructions: 'Start in push-up position. Alternate driving knees toward chest rapidly.', tips: 'Great for cardio and abs combined. Keep hips low.', calories_per_set: 7 },

  // === CARDIO ===
  { id: 27, name: 'Jumping Jacks', muscle: 'full_body', secondaryMuscles: [], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '30 seconds', instructions: 'Stand with feet together, arms at sides. Jump feet apart while raising arms overhead. Jump back to start.', tips: 'Great warm-up exercise. Land softly on balls of feet.', calories_per_set: 8 },
  { id: 28, name: 'Burpees', muscle: 'full_body', secondaryMuscles: ['chest', 'legs', 'core'], equipment: 'bodyweight', difficulty: 'intermediate', sets: '3', reps: '10-15', instructions: 'From standing, drop to push-up, perform push-up, jump feet to hands, jump up with hands overhead.', tips: 'The ultimate full-body exercise. Modify by stepping instead of jumping.', calories_per_set: 12 },
  { id: 29, name: 'High Knees', muscle: 'full_body', secondaryMuscles: ['abs', 'legs'], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '30 seconds', instructions: 'Run in place, bringing knees as high as possible. Pump arms for momentum.', tips: 'Great for cardio endurance. Keep your core tight.', calories_per_set: 9 },
  { id: 30, name: 'Jump Rope', muscle: 'full_body', secondaryMuscles: ['calves', 'shoulders'], equipment: 'jump_rope', difficulty: 'beginner', sets: '3', reps: '60 seconds', instructions: 'Hold rope handles, swing rope overhead and jump as it passes under feet. Stay on balls of feet.', tips: 'Burns 10-16 calories per minute. Start slow and build speed.', calories_per_set: 15 },

  // === GLUTES ===
  { id: 31, name: 'Hip Thrust', muscle: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'barbell', difficulty: 'intermediate', sets: '4', reps: '10-12', instructions: 'Sit with upper back against bench, barbell over hips. Drive hips up, squeezing glutes at top. Lower slowly.', tips: 'Best glute isolation exercise. Pause at the top for 2 seconds.', calories_per_set: 8 },
  { id: 32, name: 'Glute Bridge', muscle: 'glutes', secondaryMuscles: ['hamstrings', 'core'], equipment: 'bodyweight', difficulty: 'beginner', sets: '3', reps: '15-20', instructions: 'Lie on back, feet flat on floor. Drive hips up by squeezing glutes. Hold at top briefly.', tips: 'Perfect for home workouts. Add a resistance band for more challenge.', calories_per_set: 5 },
];
