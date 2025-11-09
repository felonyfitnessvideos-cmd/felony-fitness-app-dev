/**
 * @file AnatomicalMuscleMap.jsx
 * @description Anatomically accurate muscle map using react-body-highlighter
 * @project Felony Fitness - Workout Builder Platform
 * 
 * Features:
 * - Professional anatomical diagrams
 * - Front and back views
 * - Muscle highlighting based on target muscle groups
 * - Responsive and compact display
 */

import PropTypes from 'prop-types';
import Model from 'react-body-highlighter';
import './AnatomicalMuscleMap.css';

/**
 * Map our muscle names to react-body-highlighter muscle keys
 */
const MUSCLE_MAP = {
  // Chest
  'Chest': ['chest'],
  'Upper Chest': ['chest'],
  'Middle Chest': ['chest'],
  'Lower Chest': ['chest'],
  'Pectorals': ['chest'],
  'Pecs': ['chest'],
  
  // Back
  'Lats': ['upper-back'],
  'Latissimus Dorsi': ['upper-back'],
  'Upper Back': ['upper-back'],
  'Rhomboids': ['upper-back'],
  'Lower Back': ['lower-back'],
  'Erector Spinae': ['lower-back'],
  'Back': ['upper-back', 'lower-back'],
  
  // Shoulders
  'Front Delts': ['front-deltoids'],
  'Front Deltoids': ['front-deltoids'],
  'Side Delts': ['back-deltoids'],
  'Side Deltoids': ['back-deltoids'],
  'Lateral Delts': ['back-deltoids'],
  'Rear Delts': ['back-deltoids'],
  'Rear Deltoids': ['back-deltoids'],
  'Deltoids': ['front-deltoids', 'back-deltoids'],
  'Shoulders': ['front-deltoids', 'back-deltoids'],
  
  // Arms
  'Biceps': ['biceps'],
  'Triceps': ['triceps'],
  'Forearms': ['forearm'],
  'Forearm': ['forearm'],
  'Brachialis': ['biceps'], // Part of upper arm flexors
  
  // Legs
  'Quads': ['quadriceps'],
  'Quadriceps': ['quadriceps'],
  'Hamstrings': ['hamstring'],
  'Glutes': ['gluteal'],
  'Gluteus': ['gluteal'],
  'Calves': ['calves'],
  'Legs': ['quadriceps', 'hamstring', 'calves'],
  'Hip Flexors': ['quadriceps'], // Often shown as part of quads area
  'Hip Abductors': ['gluteal'], // Side glutes
  
  // Core
  'Abs': ['abs'],
  'Abdominals': ['abs'],
  'Upper Abdominals': ['abs'],
  'Middle Abdominals': ['abs'],
  'Lower Abdominals': ['abs'],
  'Obliques': ['obliques'],
  'Core': ['abs', 'obliques'],
  'Serratus Anterior': ['abs'], // Rib muscles, often shown with abs
  
  // Traps
  'Traps': ['trapezius'],
  'Traps (Upper)': ['trapezius'],
  'Trapezius': ['trapezius'],
};

/**
 * Anatomical Muscle Map Component
 * Uses react-body-highlighter for professional muscle visualization
 */
const AnatomicalMuscleMap = ({ 
  highlightedMuscles = [],
  variant = 'front',
  className = ''
}) => {
  
  /**
   * Convert our muscle names to react-body-highlighter format
   * @returns {Array} Array of muscle objects for highlighting
   */
  const getMusclesForHighlighting = () => {
    const muscleSet = new Set();
    const unmappedMuscles = [];
    
    highlightedMuscles.forEach(muscleName => {
      const mappedMuscles = MUSCLE_MAP[muscleName];
      if (mappedMuscles) {
        mappedMuscles.forEach(m => muscleSet.add(m));
      } else {
        unmappedMuscles.push(muscleName);
      }
    });
    
    const muscles = Array.from(muscleSet);
    
    return muscles.map(name => ({ name, muscles: [name] }));
  };

  const data = getMusclesForHighlighting();

  return (
    <div className={`anatomical-muscle-map ${className}`}>
      <Model
        data={data}
        style={{ width: '100%', padding: '0' }}
        type={variant} // 'front' or 'back'
        highlightedColors={['#f97316']} // Orange highlight color
      />
    </div>
  );
};

AnatomicalMuscleMap.propTypes = {
  highlightedMuscles: PropTypes.arrayOf(PropTypes.string),
  variant: PropTypes.oneOf(['front', 'back']),
  className: PropTypes.string
};

export default AnatomicalMuscleMap;
