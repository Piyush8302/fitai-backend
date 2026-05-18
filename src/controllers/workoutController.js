const Workout = require('../models/Workout');

// @desc    Get all workouts (with filters)
exports.getWorkouts = async (req, res, next) => {
  try {
    const { category, difficulty, muscle, equipment, isPremium, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (muscle) filter.targetMuscles = { $in: [muscle] };
    if (equipment) filter.equipment = { $in: [equipment] };
    if (isPremium !== undefined) filter.isPremium = isPremium === 'true';

    // Free users can't see premium
    if (!req.user?.isPremium && req.user?.role !== 'admin') {
      filter.isPremium = false;
    }

    const total = await Workout.countDocuments(filter);
    const workouts = await Workout.find(filter)
      .skip((page - 1) * limit).limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({ success: true, count: workouts.length, total, page: parseInt(page), data: workouts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single workout
exports.getWorkout = async (req, res, next) => {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ success: false, message: 'Workout not found' });

    if (workout.isPremium && !req.user?.isPremium && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Premium subscription required' });
    }

    res.json({ success: true, data: workout });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI-generated workout plan
exports.getAIWorkoutPlan = async (req, res, next) => {
  try {
    const user = req.user;
    const { goal, duration, location } = req.query; // location: home/gym

    const userGoal = goal || user.fitnessGoal || 'maintenance';
    const workoutDuration = duration || 30;
    const workoutLocation = location || 'home';

    // Generate workout based on user profile
    const plan = generateWorkoutPlan(userGoal, workoutDuration, workoutLocation, user);

    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly schedule
exports.getWeeklySchedule = async (req, res, next) => {
  try {
    const user = req.user;
    const goal = user.fitnessGoal || 'maintenance';

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule = days.map(day => {
      const isRest = day === 'sunday' || (goal !== 'muscle_building' && day === 'wednesday');
      return {
        day,
        isRestDay: isRest,
        workout: isRest ? { title: 'Rest Day', description: 'Recovery & stretching' } : generateDayWorkout(day, goal),
      };
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
};

// @desc    Create workout (Admin)
exports.createWorkout = async (req, res, next) => {
  try {
    req.body.createdBy = req.user.id;
    const workout = await Workout.create(req.body);
    res.status(201).json({ success: true, data: workout });
  } catch (error) {
    next(error);
  }
};

// @desc    Update workout (Admin)
exports.updateWorkout = async (req, res, next) => {
  try {
    const workout = await Workout.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!workout) return res.status(404).json({ success: false, message: 'Workout not found' });
    res.json({ success: true, data: workout });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete workout (Admin)
exports.deleteWorkout = async (req, res, next) => {
  try {
    const workout = await Workout.findByIdAndDelete(req.params.id);
    if (!workout) return res.status(404).json({ success: false, message: 'Workout not found' });
    res.json({ success: true, message: 'Workout deleted' });
  } catch (error) {
    next(error);
  }
};

// ---- Helper functions ----
function generateWorkoutPlan(goal, duration, location, user) {
  const exercises = {
    weight_loss: {
      home: [
        { name: 'Jumping Jacks', sets: 3, reps: '30 sec', muscle: 'full_body', caloriesBurned: 30, instructions: 'Stand with feet together, jump while spreading arms and legs', commonMistakes: 'Landing too hard on joints' },
        { name: 'Burpees', sets: 3, reps: '10', muscle: 'full_body', caloriesBurned: 50, instructions: 'Squat, kick back to plank, push-up, jump up', commonMistakes: 'Skipping the push-up portion' },
        { name: 'Mountain Climbers', sets: 3, reps: '20', muscle: 'abs', caloriesBurned: 35, instructions: 'Plank position, alternate driving knees to chest', commonMistakes: 'Raising hips too high' },
        { name: 'High Knees', sets: 3, reps: '30 sec', muscle: 'legs', caloriesBurned: 30, instructions: 'Run in place, lifting knees to hip level', commonMistakes: 'Leaning back instead of staying upright' },
        { name: 'Plank', sets: 3, reps: '30 sec', muscle: 'abs', caloriesBurned: 15, instructions: 'Hold push-up position on forearms', commonMistakes: 'Sagging hips or raising too high' },
        { name: 'Squat Jumps', sets: 3, reps: '12', muscle: 'legs', caloriesBurned: 40, instructions: 'Squat down then explode upward', commonMistakes: 'Knees caving inward on landing' },
      ],
      gym: [
        { name: 'Treadmill Run', sets: 1, reps: '15 min', muscle: 'cardio', caloriesBurned: 150, instructions: 'Maintain moderate pace, 6-8 km/h' },
        { name: 'Elliptical', sets: 1, reps: '10 min', muscle: 'full_body', caloriesBurned: 100, instructions: 'Moderate resistance, full range of motion' },
        { name: 'Cable Crunches', sets: 3, reps: '15', muscle: 'abs', caloriesBurned: 25, instructions: 'Kneel before cable machine, crunch downward' },
        { name: 'Lat Pulldown', sets: 3, reps: '12', muscle: 'back', caloriesBurned: 30, instructions: 'Pull bar to upper chest, squeeze back' },
        { name: 'Leg Press', sets: 3, reps: '12', muscle: 'legs', caloriesBurned: 40, instructions: 'Push platform away, don\'t lock knees' },
      ],
    },
    weight_gain: {
      home: [
        { name: 'Push-ups', sets: 4, reps: '15', muscle: 'chest', caloriesBurned: 25, instructions: 'Hands shoulder-width, lower chest to floor' },
        { name: 'Diamond Push-ups', sets: 3, reps: '10', muscle: 'arms', caloriesBurned: 20, instructions: 'Hands together forming diamond shape' },
        { name: 'Squats', sets: 4, reps: '20', muscle: 'legs', caloriesBurned: 35, instructions: 'Feet shoulder-width, sit back and down' },
        { name: 'Lunges', sets: 3, reps: '12 each', muscle: 'legs', caloriesBurned: 30, instructions: 'Step forward, lower back knee' },
        { name: 'Pike Push-ups', sets: 3, reps: '10', muscle: 'shoulders', caloriesBurned: 20, instructions: 'V-position push-up targeting shoulders' },
        { name: 'Dips (Chair)', sets: 3, reps: '12', muscle: 'arms', caloriesBurned: 25, instructions: 'Hands on chair, lower body by bending arms' },
      ],
      gym: [
        { name: 'Bench Press', sets: 4, reps: '8-10', muscle: 'chest', caloriesBurned: 40, instructions: 'Lower bar to mid-chest, press up' },
        { name: 'Deadlift', sets: 4, reps: '6-8', muscle: 'back', caloriesBurned: 60, instructions: 'Hinge at hips, keep back straight' },
        { name: 'Barbell Squats', sets: 4, reps: '8-10', muscle: 'legs', caloriesBurned: 50, instructions: 'Bar on upper back, squat to parallel' },
        { name: 'Shoulder Press', sets: 3, reps: '10', muscle: 'shoulders', caloriesBurned: 30, instructions: 'Press dumbbells overhead' },
        { name: 'Barbell Curls', sets: 3, reps: '12', muscle: 'arms', caloriesBurned: 20, instructions: 'Curl bar up, keep elbows stationary' },
      ],
    },
    muscle_building: {
      home: [
        { name: 'Push-ups (Wide)', sets: 4, reps: '15', muscle: 'chest', caloriesBurned: 25 },
        { name: 'Pull-ups (Door bar)', sets: 4, reps: '8', muscle: 'back', caloriesBurned: 30 },
        { name: 'Pistol Squats', sets: 3, reps: '6 each', muscle: 'legs', caloriesBurned: 30 },
        { name: 'Handstand Push-ups', sets: 3, reps: '5', muscle: 'shoulders', caloriesBurned: 25 },
        { name: 'Plank to Push-up', sets: 3, reps: '10', muscle: 'abs', caloriesBurned: 20 },
      ],
      gym: [
        { name: 'Incline Bench Press', sets: 4, reps: '8', muscle: 'chest', caloriesBurned: 45 },
        { name: 'Bent Over Rows', sets: 4, reps: '10', muscle: 'back', caloriesBurned: 40 },
        { name: 'Leg Press', sets: 4, reps: '10', muscle: 'legs', caloriesBurned: 50 },
        { name: 'Lateral Raises', sets: 3, reps: '12', muscle: 'shoulders', caloriesBurned: 20 },
        { name: 'Tricep Pushdown', sets: 3, reps: '12', muscle: 'arms', caloriesBurned: 15 },
        { name: 'Hammer Curls', sets: 3, reps: '12', muscle: 'arms', caloriesBurned: 15 },
      ],
    },
  };

  const defaultExercises = exercises.weight_loss;
  const goalExercises = exercises[goal] || defaultExercises;
  const selected = goalExercises[location] || goalExercises.home;
  const totalCalories = selected.reduce((sum, e) => sum + (e.caloriesBurned || 0) * (e.sets || 3), 0);

  return {
    title: `${goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${location.charAt(0).toUpperCase() + location.slice(1)} Workout`,
    goal, location, duration: parseInt(duration),
    totalCalories,
    exercises: selected.map(e => ({ ...e, restSeconds: 60, equipment: location === 'gym' ? 'machine' : 'bodyweight' })),
  };
}

function generateDayWorkout(day, goal) {
  const splits = {
    weight_loss: { monday: 'Cardio + Abs', tuesday: 'Upper Body', thursday: 'Lower Body', friday: 'HIIT', saturday: 'Full Body' },
    weight_gain: { monday: 'Chest + Triceps', tuesday: 'Back + Biceps', thursday: 'Legs', friday: 'Shoulders + Arms', saturday: 'Full Body' },
    muscle_building: { monday: 'Chest', tuesday: 'Back', thursday: 'Legs', friday: 'Shoulders', saturday: 'Arms + Abs' },
  };
  const split = splits[goal] || splits.weight_loss;
  return { title: split[day] || 'Active Recovery', description: `${split[day] || 'Light'} workout day`, duration: 45 };
}

module.exports = exports;
