/**
 * Framer Motion animation variants and utilities
 * Following Material Design motion principles
 *
 * Duration guidelines:
 * - Small elements (icons, chips): 100-200ms
 * - Medium elements (cards, dialogs): 200-300ms
 * - Large elements (panels, pages): 300-400ms
 */

import { type Variants, type Transition } from 'framer-motion';

/**
 * Standard easing curves from Material Design
 */
export const easings = {
  // Deceleration - for elements entering
  easeOut: [0.0, 0.0, 0.2, 1] as const,
  // Acceleration - for elements exiting
  easeIn: [0.4, 0.0, 1, 1] as const,
  // Standard - for moving between positions
  standard: [0.4, 0.0, 0.2, 1] as const,
  // Sharp - for quick transitions
  sharp: [0.4, 0.0, 0.6, 1] as const,
} as const;

/**
 * Stagger container for lists (60ms between items per Material Design)
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0,
    },
  },
};

/**
 * Stagger item for use with staggerContainer (200ms for small elements)
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: easings.easeOut,
    },
  },
};

/**
 * Spring transition for icons (150ms with proper physics)
 * Use for small interactive elements
 */
export const iconSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.5,
};
