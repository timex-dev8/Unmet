// The motion features the Studio uses, loaded on demand (components/motion/MotionProvider.tsx).
// domMax (not domAnimation) because the feed's swipe card drags and the nav highlight uses layout animations.
import { domMax } from "motion/react";

export default domMax;
