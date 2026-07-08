import React, { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Icon from '@/components/Icon';
import s from "./index.module.css";

interface Props {
  title: string;
  children: ReactNode;
}

export default function PageLayout({ title, children }: Props) {
  const navigate = useNavigate();

  return (
    <div className={s.page}>
      <div className={s.top}>
        <button className={s.back} onClick={() => navigate("/")}>
          <Icon type="arrow-left" size={16} />
        </button>
        {/* <h2 className={s.title}>{title}</h2> */}
      </div>
      <div className={s.content}>{children}</div>
    </div>
  );
}
