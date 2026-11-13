"use client";

import { useState } from "react";
import { IconCheck, IconChevron, IconWhatsApp } from "@/components/trafego/icons";
import { quizMessage, trafego } from "@/content/trafego";

/**
 * Quiz de 3 perguntas: cada resposta avança para a próxima; no fim, as respostas viram uma mensagem pronta no WhatsApp.
 */
export function TrafficQuiz({ whatsapp }: { whatsapp: string }) {
  const { questions, doneTitle, doneText, send, reset } = trafego.quiz;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([null, null, null]);
  const done = step >= questions.length;

  function answer(option: string) {
    setAnswers((current) => current.map((value, index) => index === step ? option : value));
    setStep((current) => current + 1);
  }

  if (done) {
    const [business, advertises, budget] = answers.map((value) => value ?? "");
    const href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(quizMessage(business, advertises, budget))}`;
    return <div className="tf-quiz-card" aria-live="polite">
      <div className="tf-quiz-done">
        <span className="tf-quiz-done-mark"><IconCheck size={22} width={2.4} /></span>
        <strong>{doneTitle}</strong>
      </div>
      <div className="tf-quiz-chips">{answers.map((value, index) => <span key={index}>{value}</span>)}</div>
      <p>{doneText}</p>
      <a className="tf-btn tf-btn-primary tf-quiz-send" href={href} target="_blank" rel="noopener noreferrer">
        <IconWhatsApp />{send}
      </a>
      <button type="button" className="tf-quiz-reset" onClick={() => { setStep(0); setAnswers([null, null, null]); }}>{reset}</button>
    </div>;
  }

  const current = questions[step];
  return <div className="tf-quiz-card" aria-live="polite">
    <div className="tf-quiz-progress">
      {step > 0 ? <button type="button" className="tf-quiz-back" aria-label="Voltar" onClick={() => setStep((value) => Math.max(0, value - 1))}><IconChevron direction="left" size={16} /></button> : null}
      <div className="tf-quiz-bars" aria-hidden="true">{questions.map((_, index) => <span key={index} className={index < step ? "is-done" : index === step ? "is-now" : undefined} />)}</div>
      <span className="tf-quiz-count">{step + 1}/{questions.length}</span>
    </div>
    <h3>{current.question}</h3>
    <div className="tf-quiz-options">
      {current.options.map((option) => <button key={option} type="button" aria-pressed={answers[step] === option} onClick={() => answer(option)}>{option}</button>)}
    </div>
  </div>;
}
