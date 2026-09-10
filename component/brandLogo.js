import styles from "./app.module.css";

export default function BrandLogo() {
  return (
    <>
      <span className={styles.brandIcon} aria-hidden="true">÷</span>
      <span>몫대로</span>
    </>
  );
}
