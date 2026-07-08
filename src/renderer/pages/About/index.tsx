import React from 'react';
import { useT } from '@/i18n';
import PageLayout from '@/components/PageLayout';

export default function About() {
  const { t } = useT();

  return (
    <PageLayout title={t.aboutTitle}>
      <p>{t.aboutDesc}</p>
      <ul>
        <li>{t.aboutBullet1}</li>
        <li>{t.aboutBullet2}</li>
        <li>{t.aboutBullet3}</li>
      </ul>
    </PageLayout>
  );
}
