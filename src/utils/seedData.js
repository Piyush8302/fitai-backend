const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '../../.env') });

const User = require('../models/User');
const Workout = require('../models/Workout');
const DietPlan = require('../models/DietPlan');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create admin user
    const adminExists = await User.findOne({ email: 'admin@fitai.com' });
    if (!adminExists) {
      await User.create({
        name: 'FitAI Admin',
        email: 'admin@fitai.com',
        password: 'admin123',
        role: 'admin',
        isPremium: true,
        isProfileComplete: true,
        age: 25, gender: 'male', height: 175, weight: 70,
        fitnessGoal: 'maintenance', activityLevel: 'moderately_active',
      });
      console.log('✅ Admin user created (admin@fitai.com / admin123)');
    }

    // Create test user
    const testExists = await User.findOne({ email: 'test@fitai.com' });
    if (!testExists) {
      await User.create({
        name: 'Test User',
        email: 'test@fitai.com',
        password: 'test123',
        isProfileComplete: true,
        age: 22, gender: 'male', height: 170, weight: 75,
        targetWeight: 68, fitnessGoal: 'weight_loss',
        activityLevel: 'moderately_active', dietPreference: 'veg',
      });
      console.log('✅ Test user created (test@fitai.com / test123)');
    }

    // Seed sample workouts
    const workoutCount = await Workout.countDocuments();
    if (workoutCount === 0) {
      await Workout.insertMany([
        {
          title: 'Fat Burn HIIT - Home',
          description: '30 minute high intensity interval training for maximum fat burn at home',
          category: 'weight_loss', difficulty: 'intermediate', duration: 30, caloriesBurned: 350,
          targetMuscles: ['full_body', 'abs', 'legs'], equipment: ['bodyweight'],
          exercises: [
            { name: 'Jumping Jacks', muscle: 'full_body', sets: 3, reps: '30 sec', restSeconds: 30, caloriesBurned: 30, instructions: 'Jump while spreading arms and legs wide' },
            { name: 'Burpees', muscle: 'full_body', sets: 3, reps: '10', restSeconds: 45, caloriesBurned: 50, instructions: 'Squat, kick back, push-up, jump up' },
            { name: 'Mountain Climbers', muscle: 'abs', sets: 3, reps: '20', restSeconds: 30, caloriesBurned: 35, instructions: 'Plank position, alternate driving knees' },
            { name: 'Squat Jumps', muscle: 'legs', sets: 3, reps: '12', restSeconds: 45, caloriesBurned: 40, instructions: 'Squat down, explode upward' },
            { name: 'Plank', muscle: 'abs', sets: 3, reps: '45 sec', restSeconds: 30, caloriesBurned: 20, instructions: 'Hold push-up position on forearms' },
          ],
        },
        {
          title: 'Muscle Building - Gym (Push Day)',
          description: 'Chest, Shoulders & Triceps workout for muscle gain',
          category: 'muscle_building', difficulty: 'intermediate', duration: 50, caloriesBurned: 400,
          targetMuscles: ['chest', 'shoulders', 'arms'], equipment: ['barbell', 'dumbbells', 'machine'],
          isPremium: true,
          exercises: [
            { name: 'Flat Bench Press', muscle: 'chest', sets: 4, reps: '8-10', restSeconds: 90, caloriesBurned: 50, instructions: 'Lower bar to mid chest, press up explosively' },
            { name: 'Incline Dumbbell Press', muscle: 'chest', sets: 3, reps: '10-12', restSeconds: 75, caloriesBurned: 40, instructions: '30 degree incline, press dumbbells up' },
            { name: 'Overhead Press', muscle: 'shoulders', sets: 4, reps: '8-10', restSeconds: 90, caloriesBurned: 40, instructions: 'Press barbell overhead, full lockout' },
            { name: 'Lateral Raises', muscle: 'shoulders', sets: 3, reps: '15', restSeconds: 60, caloriesBurned: 20, instructions: 'Raise dumbbells to sides, slight bend in elbows' },
            { name: 'Tricep Pushdowns', muscle: 'arms', sets: 3, reps: '12-15', restSeconds: 60, caloriesBurned: 15, instructions: 'Cable pushdown, squeeze at bottom' },
          ],
        },
        {
          title: 'Beginner Home Workout',
          description: 'Easy full body workout for beginners, no equipment needed',
          category: 'home', difficulty: 'beginner', duration: 20, caloriesBurned: 150,
          targetMuscles: ['full_body'], equipment: ['bodyweight'],
          exercises: [
            { name: 'Wall Push-ups', muscle: 'chest', sets: 3, reps: '10', restSeconds: 45, caloriesBurned: 15, instructions: 'Push up against a wall at arm length' },
            { name: 'Bodyweight Squats', muscle: 'legs', sets: 3, reps: '15', restSeconds: 45, caloriesBurned: 25, instructions: 'Feet shoulder width, sit back' },
            { name: 'Standing Crunches', muscle: 'abs', sets: 3, reps: '15', restSeconds: 30, caloriesBurned: 15, instructions: 'Bring knee to opposite elbow while standing' },
            { name: 'Lunges', muscle: 'legs', sets: 3, reps: '10 each', restSeconds: 45, caloriesBurned: 25, instructions: 'Step forward, lower back knee' },
          ],
        },
        {
          title: 'Stretching & Height Growth',
          description: 'Daily stretching routine for posture improvement and flexibility',
          category: 'stretching', difficulty: 'beginner', duration: 15, caloriesBurned: 50,
          targetMuscles: ['full_body'], equipment: ['bodyweight'],
          exercises: [
            { name: 'Cobra Stretch', muscle: 'full_body', sets: 3, reps: '20 sec', restSeconds: 15, instructions: 'Lie face down, push chest up with arms' },
            { name: 'Cat-Cow Stretch', muscle: 'back', sets: 3, reps: '10', restSeconds: 15, instructions: 'On hands and knees, arch and round back' },
            { name: 'Hanging', muscle: 'full_body', sets: 3, reps: '20 sec', restSeconds: 30, instructions: 'Hang from a bar with arms fully extended' },
            { name: 'Toe Touches', muscle: 'legs', sets: 3, reps: '15', restSeconds: 15, instructions: 'Stand straight, bend to touch toes' },
            { name: 'Child Pose', muscle: 'back', sets: 2, reps: '30 sec', restSeconds: 15, instructions: 'Kneel, sit on heels, stretch arms forward' },
          ],
        },
      ]);
      console.log('✅ Sample workouts created (4 workouts)');
    }

    // Seed sample diet plans
    const dietCount = await DietPlan.countDocuments();
    if (dietCount === 0) {
      await DietPlan.insertMany([
        {
          title: 'Weight Loss Veg Diet Plan',
          description: 'Indian vegetarian diet plan for healthy weight loss',
          goal: 'weight_loss', dietType: 'veg', totalCalories: 1500, totalProtein: 65, waterIntake: 3.5,
          meals: [
            { type: 'breakfast', time: '8:00 AM', items: [{ name: 'Moong Dal Chilla', quantity: '2 pcs', calories: 200, protein: 12, carbs: 25, fat: 5 }], totalCalories: 200 },
            { type: 'mid_morning', time: '10:30 AM', items: [{ name: 'Green Tea + Almonds', quantity: '1 cup + 10 pcs', calories: 80, protein: 3, carbs: 4, fat: 6 }], totalCalories: 80 },
            { type: 'lunch', time: '1:00 PM', items: [{ name: '2 Roti + Dal + Sabzi + Salad', quantity: '1 plate', calories: 450, protein: 18, carbs: 55, fat: 12 }], totalCalories: 450 },
            { type: 'evening_snack', time: '4:30 PM', items: [{ name: 'Sprouts + Lemon', quantity: '1 bowl', calories: 120, protein: 8, carbs: 18, fat: 2 }], totalCalories: 120 },
            { type: 'dinner', time: '7:30 PM', items: [{ name: '1 Roti + Palak Paneer', quantity: '1 plate', calories: 350, protein: 18, carbs: 30, fat: 14 }], totalCalories: 350 },
          ],
        },
        {
          title: 'Muscle Gain Non-Veg Diet Plan',
          description: 'High protein non-veg diet for muscle building',
          goal: 'muscle_building', dietType: 'non_veg', totalCalories: 2800, totalProtein: 140, waterIntake: 4,
          isPremium: true,
          meals: [
            { type: 'breakfast', time: '7:30 AM', items: [{ name: 'Egg Bhurji + Toast + Milk', quantity: '4 eggs + 2 toast', calories: 500, protein: 30, carbs: 35, fat: 22 }], totalCalories: 500 },
            { type: 'mid_morning', time: '10:00 AM', items: [{ name: 'Protein Shake + Banana', quantity: '1 scoop + 1', calories: 250, protein: 28, carbs: 30, fat: 2 }], totalCalories: 250 },
            { type: 'lunch', time: '1:00 PM', items: [{ name: 'Chicken Curry + Rice + Salad', quantity: '200g + 1 cup', calories: 650, protein: 40, carbs: 60, fat: 18 }], totalCalories: 650 },
            { type: 'evening_snack', time: '4:30 PM', items: [{ name: 'Peanut Butter Sandwich + Milk', quantity: '2 slices + 1 glass', calories: 400, protein: 16, carbs: 40, fat: 18 }], totalCalories: 400 },
            { type: 'dinner', time: '8:00 PM', items: [{ name: 'Fish + Roti + Dal', quantity: '150g + 2 roti', calories: 550, protein: 35, carbs: 50, fat: 15 }], totalCalories: 550 },
            { type: 'post_workout', time: '6:30 PM', items: [{ name: 'Whey Protein + Oats', quantity: '1 scoop + 50g', calories: 300, protein: 30, carbs: 35, fat: 5 }], totalCalories: 300 },
          ],
        },
      ]);
      console.log('✅ Sample diet plans created (2 plans)');
    }

    console.log('\n🎉 Seed completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedDB();
