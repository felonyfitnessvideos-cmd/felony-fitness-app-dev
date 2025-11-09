/**
 * @fileoverview Intelligent Routine Generation from Exercise Pools
 * @description Generates workout routines by intelligently distributing exercises
 * across training days based on muscle groups and training frequency.
 * 
 * @author Felony Fitness Development Team
 * @version 1.0.0
 * @since 2025-11-09
 */

/**
 * Generate workout routines from an exercise pool based on training frequency
 * 
 * @description Takes a program's exercise pool and distributes exercises intelligently
 * across N training days using proven split patterns (Upper/Lower, Push/Pull/Legs, etc.)
 * 
 * @param {Array<Object>} exercisePool - Array of exercises with muscle group data
 * @param {number} frequency - Training days per week (2-7)
 * @param {Object} options - Configuration options
 * @param {boolean} options.balanceVolume - Try to balance total sets across days
 * @param {boolean} options.prioritizeMuscleGroups - Group similar muscles together
 * 
 * @returns {Array<Object>} Array of routine objects with exercises distributed
 * 
 * @example
 * const routines = generateRoutines(exercisePool, 3);
 * // Returns: [
 * //   { name: "Push Day", exercises: [...], muscle_groups: ["Chest", "Triceps", ...] },
 * //   { name: "Pull Day", exercises: [...], muscle_groups: ["Back", "Biceps", ...] },
 * //   { name: "Legs Day", exercises: [...], muscle_groups: ["Quadriceps", ...] }
 * // ]
 */
export function generateRoutines(exercisePool, frequency, options = {}) {
  const {
    balanceVolume = true
    // prioritizeMuscleGroups option reserved for future use
  } = options;

  // Validate inputs
  if (!exercisePool || exercisePool.length === 0) {
    return [];
  }

  if (frequency < 2 || frequency > 7) {
    throw new Error('Frequency must be between 2 and 7 days per week');
  }

  // Group exercises by primary muscle
  const exercisesByMuscle = groupExercisesByMuscle(exercisePool);

  // Generate split pattern based on frequency
  const splitPattern = getSplitPattern(frequency);

  // Distribute exercises across routines
  const routines = distributeExercises(exercisesByMuscle, splitPattern, balanceVolume);

  return routines;
}

/**
 * Group exercises by their primary muscle group
 * @private
 */
function groupExercisesByMuscle(exercisePool) {
  const grouped = {};

  exercisePool.forEach(exercise => {
    const primaryMuscles = exercise.muscle_groups?.primary || [];
    
    primaryMuscles.forEach(muscle => {
      if (!grouped[muscle]) {
        grouped[muscle] = [];
      }
      grouped[muscle].push(exercise);
    });
  });

  return grouped;
}

/**
 * Get training split pattern based on frequency
 * @private
 */
function getSplitPattern(frequency) {
  const patterns = {
    2: [
      { name: 'Upper Body', muscles: ['Middle Chest', 'Upper Chest', 'Lower Chest', 'Latissimus Dorsi', 'Front Deltoids', 'Side Deltoids', 'Rear Deltoids', 'Biceps', 'Triceps', 'Trapezius'] },
      { name: 'Lower Body', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Hip Abductors', 'Hip Adductors', 'Lower Back', 'Erector Spinae', 'Upper Abdominals', 'Lower Abdominals', 'Obliques'] }
    ],
    3: [
      { name: 'Push Day', muscles: ['Middle Chest', 'Upper Chest', 'Lower Chest', 'Front Deltoids', 'Side Deltoids', 'Triceps'] },
      { name: 'Pull Day', muscles: ['Latissimus Dorsi', 'Rear Deltoids', 'Trapezius', 'Rhomboids', 'Lower Trapezius', 'Biceps', 'Brachialis', 'Forearms'] },
      { name: 'Legs Day', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Hip Abductors', 'Hip Adductors', 'Erector Spinae', 'Upper Abdominals', 'Lower Abdominals', 'Obliques'] }
    ],
    4: [
      { name: 'Upper Power', muscles: ['Middle Chest', 'Upper Chest', 'Latissimus Dorsi', 'Front Deltoids', 'Rear Deltoids'] },
      { name: 'Lower Power', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Erector Spinae'] },
      { name: 'Upper Hypertrophy', muscles: ['Middle Chest', 'Lower Chest', 'Latissimus Dorsi', 'Side Deltoids', 'Biceps', 'Triceps'] },
      { name: 'Lower Hypertrophy', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Upper Abdominals', 'Lower Abdominals', 'Obliques'] }
    ],
    5: [
      { name: 'Chest & Triceps', muscles: ['Middle Chest', 'Upper Chest', 'Lower Chest', 'Triceps', 'Front Deltoids'] },
      { name: 'Back & Biceps', muscles: ['Latissimus Dorsi', 'Trapezius', 'Rhomboids', 'Rear Deltoids', 'Biceps', 'Forearms'] },
      { name: 'Legs', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'] },
      { name: 'Shoulders & Arms', muscles: ['Front Deltoids', 'Side Deltoids', 'Rear Deltoids', 'Biceps', 'Triceps'] },
      { name: 'Full Body & Core', muscles: ['Upper Abdominals', 'Lower Abdominals', 'Obliques', 'Erector Spinae', 'Lower Back'] }
    ],
    6: [
      { name: 'Push A', muscles: ['Middle Chest', 'Upper Chest', 'Front Deltoids', 'Triceps'] },
      { name: 'Pull A', muscles: ['Latissimus Dorsi', 'Trapezius', 'Rear Deltoids', 'Biceps'] },
      { name: 'Legs A', muscles: ['Quadriceps', 'Glutes', 'Calves'] },
      { name: 'Push B', muscles: ['Lower Chest', 'Side Deltoids', 'Triceps', 'Serratus Anterior'] },
      { name: 'Pull B', muscles: ['Latissimus Dorsi', 'Rhomboids', 'Biceps', 'Forearms'] },
      { name: 'Legs B', muscles: ['Hamstrings', 'Glutes', 'Calves', 'Upper Abdominals', 'Lower Abdominals', 'Obliques'] }
    ],
    7: [
      { name: 'Chest Heavy', muscles: ['Middle Chest', 'Upper Chest', 'Triceps'] },
      { name: 'Back Heavy', muscles: ['Latissimus Dorsi', 'Trapezius', 'Rear Deltoids'] },
      { name: 'Legs Heavy', muscles: ['Quadriceps', 'Hamstrings', 'Glutes'] },
      { name: 'Shoulders & Arms', muscles: ['Front Deltoids', 'Side Deltoids', 'Rear Deltoids', 'Biceps', 'Triceps'] },
      { name: 'Chest Volume', muscles: ['Middle Chest', 'Lower Chest', 'Triceps'] },
      { name: 'Back Volume', muscles: ['Latissimus Dorsi', 'Rhomboids', 'Biceps', 'Forearms'] },
      { name: 'Legs Volume', muscles: ['Quadriceps', 'Hamstrings', 'Calves', 'Upper Abdominals', 'Lower Abdominals'] }
    ]
  };

  return patterns[frequency] || patterns[3]; // Default to 3-day split
}

/**
 * Distribute exercises across routines based on split pattern
 * @private
 */
function distributeExercises(exercisesByMuscle, splitPattern, balanceVolume) {
  const routines = splitPattern.map(day => ({
    name: day.name,
    exercises: [],
    muscle_groups: [],
    total_sets: 0,
    target_muscles: day.muscles
  }));

  // Track which exercises have been assigned
  const assignedExercises = new Set();
  const muscleGroupsSet = routines.map(() => new Set());

  // First pass: Assign exercises to their best matching day
  Object.entries(exercisesByMuscle).forEach(([muscle, exercises]) => {
    exercises.forEach(exercise => {
      if (assignedExercises.has(exercise.exercise_id)) return;

      // Find best matching routine for this exercise
      const bestRoutineIndex = findBestRoutine(muscle, routines, exercise);
      
      if (bestRoutineIndex !== -1) {
        routines[bestRoutineIndex].exercises.push(exercise);
        routines[bestRoutineIndex].total_sets += exercise.sets || 3;
        assignedExercises.add(exercise.exercise_id);

        // Track muscle groups
        exercise.muscle_groups?.primary?.forEach(m => muscleGroupsSet[bestRoutineIndex].add(m));
        exercise.muscle_groups?.secondary?.forEach(m => muscleGroupsSet[bestRoutineIndex].add(m));
      }
    });
  });

  // Convert muscle group sets to arrays
  routines.forEach((routine, idx) => {
    routine.muscle_groups = Array.from(muscleGroupsSet[idx]);
  });

  // Balance volume if requested
  if (balanceVolume) {
    balanceRoutineVolume(routines);
  }

  return routines;
}

/**
 * Find the best routine index for an exercise based on its primary muscle
 * @private
 */
function findBestRoutine(muscle, routines, _exercise) {
  // First, try to find a routine that targets this muscle
  for (let i = 0; i < routines.length; i++) {
    if (routines[i].target_muscles.includes(muscle)) {
      return i;
    }
  }

  // If no exact match, find the routine with the least exercises
  let minIndex = 0;
  let minCount = routines[0].exercises.length;
  
  for (let i = 1; i < routines.length; i++) {
    if (routines[i].exercises.length < minCount) {
      minCount = routines[i].exercises.length;
      minIndex = i;
    }
  }

  return minIndex;
}

/**
 * Balance volume across routines by moving exercises if needed
 * @private
 */
function balanceRoutineVolume(routines) {
  // Calculate average sets per routine
  const totalSets = routines.reduce((sum, r) => sum + r.total_sets, 0);
  const avgSets = totalSets / routines.length;
  const threshold = avgSets * 0.3; // Allow 30% variance

  // Track volume status for each routine
  // Future: Could move exercises between routines to balance
  routines.forEach(routine => {
    routine.volume_status = 
      routine.total_sets > avgSets + threshold ? 'heavy' :
      routine.total_sets < avgSets - threshold ? 'light' :
      'balanced';
  });
}

/**
 * Generate routine name suggestions based on exercises
 */
export function suggestRoutineName(exercises) {
  if (!exercises || exercises.length === 0) return 'Workout';

  const muscles = new Set();
  exercises.forEach(ex => {
    ex.muscle_groups?.primary?.forEach(m => muscles.add(m));
  });

  const muscleArray = Array.from(muscles);
  
  // Common groupings
  const isChest = muscleArray.some(m => m.includes('Chest'));
  const isBack = muscleArray.some(m => m.includes('Dorsi') || m.includes('Trapezius'));
  const isLegs = muscleArray.some(m => m.includes('Quadriceps') || m.includes('Hamstrings'));
  const isShoulders = muscleArray.some(m => m.includes('Deltoids'));

  if (isChest && !isBack && !isLegs) return 'Chest & Push';
  if (isBack && !isChest && !isLegs) return 'Back & Pull';
  if (isLegs) return 'Legs & Lower Body';
  if (isShoulders) return 'Shoulders & Arms';
  
  return 'Full Body';
}
