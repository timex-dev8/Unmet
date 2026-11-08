import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.title} />
      <div className={styles.block} />
      <div className={styles.block} />
      <div className={styles.block} />
    </div>
  );
}
