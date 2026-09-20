"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  RECONSTRUCTION_OPTIONS,
  STRUCTURAL_OPTIONS,
  SUBUNIT_OPTIONS,
} from "@/data/options";
import type { MohsCase } from "@/lib/types";

type Props = {
  cases: MohsCase[];
};

type AnswerState = {
  subunits: string[];
  structural: string;
  reconstruction: string;
};

const emptyAnswers: AnswerState = {
  subunits: [],
  structural: "",
  reconstruction: "",
};

const submissionStorageKey =
  "crabsmcchaffey-mohs-recon-submissions";

const feedbackFormBaseUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSfS5eYWgZ1MVmS3IObW_h4m8NgSRF_GpKzfS_1P0KXGQScLVg/viewform";

function feedbackFormUrl(caseId: string) {
  const params = new URLSearchParams({
    usp: "pp_url",
    "entry.1352606672": caseId,
  });

  return `${feedbackFormBaseUrl}?${params.toString()}`;
}

const facialSubsites = [
  {
    id: "nose",
    label: "Nose",
    enabled: true,
  },
  {
    id: "eyelid",
    label: "Eyelid / Periocular",
    enabled: false,
  },
  {
    id: "ear",
    label: "Ear",
    enabled: false,
  },
  {
    id: "lip",
    label: "Lip",
    enabled: false,
  },
  {
    id: "cheek",
    label: "Cheek",
    enabled: false,
  },
  {
    id: "forehead",
    label: "Forehead / Temple",
    enabled: false,
  },
  {
    id: "scalp",
    label: "Scalp",
    enabled: false,
  },
];

function sameSet(a: string[], b: string[]) {
  return (
    a.length === b.length &&
    a.every((item) => b.includes(item))
  );
}

function randomDifferentIndex(
  length: number,
  currentIndex: number
) {
  if (length <= 1) {
    return 0;
  }

  let nextIndex = currentIndex;

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }

  return nextIndex;
}

function subunitLabel(id: string) {
  return (
    SUBUNIT_OPTIONS.find(
      ([optionId]) => optionId === id
    )?.[1] ?? id
  );
}

function structuralLabel(id: string) {
  return (
    STRUCTURAL_OPTIONS.find(
      ([optionId]) => optionId === id
    )?.[1] ?? id
  );
}

function reconstructionLabel(id: string) {
  return (
    RECONSTRUCTION_OPTIONS.find(
      ([optionId]) => optionId === id
    )?.[1] ?? id
  );
}

function formatSubunits(ids: string[]) {
  return ids.length > 0
    ? ids.map(subunitLabel).join(", ")
    : "None selected";
}

function displayCaseNumber(caseId: string) {
  const match = caseId.match(/(\d+)$/);

  if (!match) {
    return caseId;
  }

  return `Case ${Number(match[1])}`;
}

export function CaseTrainer({
  cases,
}: Props) {
  const [caseIndex, setCaseIndex] =
    useState(0);

  const [answers, setAnswers] =
    useState<AnswerState>(
      emptyAnswers
    );

  const [submitted, setSubmitted] =
    useState(false);

  const [
    submittedCount,
    setSubmittedCount,
  ] = useState(0);

  useEffect(() => {
    const stored = Number(
      window.localStorage.getItem(
        submissionStorageKey
      ) ?? "0"
    );

    if (
      Number.isFinite(stored) &&
      stored >= 0
    ) {
      setSubmittedCount(stored);
    }

    if (cases.length > 1) {
      setCaseIndex(
        Math.floor(
          Math.random() *
            cases.length
        )
      );
    }
  }, [cases.length]);

  const current =
    cases[caseIndex];

  const grade = useMemo(() => {
    if (!submitted || !current) {
      return null;
    }

    const subunits =
      sameSet(
        answers.subunits,
        current.answers.subunits
      );

    const structural =
      answers.structural ===
      current.answers
        .structuralRequirement;

    const preferred =
      answers.reconstruction ===
      current.answers
        .preferredReconstruction;

    const alternative =
      current.feedback
        .acceptableAlternatives
        .some(
          (item) =>
            item.id ===
            answers.reconstruction
        );

    return {
      subunits,
      structural,
      preferred,
      alternative,
    };
  }, [
    answers,
    current,
    submitted,
  ]);

  if (!current) {
    return (
      <main className="empty">
        No reviewed or final
        cases are available.
      </main>
    );
  }

  function loadCase(
    index: number
  ) {
    setCaseIndex(index);
    setAnswers(emptyAnswers);
    setSubmitted(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function submit() {
    if (submitted) {
      return;
    }

    const nextCount =
      submittedCount + 1;

    setSubmittedCount(
      nextCount
    );

    window.localStorage.setItem(
      submissionStorageKey,
      String(nextCount)
    );

    setSubmitted(true);
  }

  function nextCase() {
    loadCase(
      randomDifferentIndex(
        cases.length,
        caseIndex
      )
    );
  }

  return (
    <main className="app-shell">

      <header className="hero">
        <div className="hero-mark">
          <Image
            src="/crabs.png"
            alt="CrabsMcChaffey logo"
            width={180}
            height={80}
            priority
          />
        </div>

        <h1>
          🦀🦀 CrabsMcChaffey Mohs
          Recon Dojo 🦀🦀
        </h1>

        <p>
          Interactive facial Mohs
          reconstruction drills
        </p>
      </header>

      <nav
        className="subsite-tabs"
        aria-label="Facial subsite modules"
      >
        {facialSubsites.map(
          (subsite) => (
            <button
              key={subsite.id}
              className={
                subsite.enabled
                  ? "active"
                  : ""
              }
              disabled={
                !subsite.enabled
              }
              title={
                subsite.enabled
                  ? undefined
                  : "Coming soon"
              }
            >
              {subsite.label}
            </button>
          )
        )}
      </nav>

      <section className="workspace">

        <aside className="image-panel">
          <div className="image-card">
            {current.images.map(
              (image) => (
                <figure
                  key={image.src}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={1400}
                    height={1400}
                    priority
                  />

                  {current.images
                    .length > 1 && (
                    <figcaption>
                      {image.label}
                    </figcaption>
                  )}
                </figure>
              )
            )}
          </div>
        </aside>

        <article className="case-content">

          <section className="vignette">
            <div className="case-meta">

              <span className="case-id">
                <strong>
                  {displayCaseNumber(
                    current.caseId
                  )}
                </strong>
                {" · "}
                {current.caseId}
              </span>

              <a
                className="feedback-link"
                href={feedbackFormUrl(
                  current.caseId
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Report an issue with
                this case ↗
              </a>

            </div>

            <p>
              {current.vignette.text}
            </p>
          </section>

          <Question
            title="1. Which aesthetic subunit(s) are involved?"
            result={grade?.subunits}
          >
            <div className="choices two-column">

              {SUBUNIT_OPTIONS.map(
                ([id, label]) => (
                  <label
                    key={id}
                    className="choice"
                  >
                    <input
                      type="checkbox"
                      checked={
                        answers.subunits.includes(
                          id
                        )
                      }
                      disabled={
                        submitted
                      }
                      onChange={(
                        event
                      ) =>
                        setAnswers(
                          (state) => ({
                            ...state,

                            subunits:
                              event
                                .target
                                .checked
                                ? [
                                    ...state.subunits,
                                    id,
                                  ]
                                : state.subunits.filter(
                                    (
                                      item
                                    ) =>
                                      item !==
                                      id
                                  ),
                          })
                        )
                      }
                    />

                    <span>
                      {label}
                    </span>
                  </label>
                )
              )}

            </div>
          </Question>

          <Question
            title="2. What structural reconstruction is required?"
            result={grade?.structural}
          >
            <div className="choices">

              {STRUCTURAL_OPTIONS.map(
                ([id, label]) => (
                  <label
                    key={id}
                    className="choice"
                  >
                    <input
                      type="radio"
                      name="structural"
                      value={id}
                      checked={
                        answers.structural ===
                        id
                      }
                      disabled={
                        submitted
                      }
                      onChange={() =>
                        setAnswers(
                          (state) => ({
                            ...state,
                            structural:
                              id,
                          })
                        )
                      }
                    />

                    <span>
                      {label}
                    </span>
                  </label>
                )
              )}

            </div>
          </Question>

          <Question
            title="3. What is your preferred reconstruction?"
            result={grade?.preferred}
            alternative={
              grade?.alternative
            }
          >
            <div className="choices">

              {RECONSTRUCTION_OPTIONS.map(
                ([id, label]) => (
                  <label
                    key={id}
                    className="choice"
                  >
                    <input
                      type="radio"
                      name="reconstruction"
                      value={id}
                      checked={
                        answers.reconstruction ===
                        id
                      }
                      disabled={
                        submitted
                      }
                      onChange={() =>
                        setAnswers(
                          (state) => ({
                            ...state,
                            reconstruction:
                              id,
                          })
                        )
                      }
                    />

                    <span>
                      {label}
                    </span>
                  </label>
                )
              )}

            </div>
          </Question>

          {!submitted ? (
            <button
              className="primary"
              disabled={
                !answers.subunits
                  .length ||
                !answers.structural ||
                !answers.reconstruction
              }
              onClick={submit}
            >
              Submit
            </button>
          ) : (
            <section
              className="results"
              aria-live="polite"
            >

              <p className="eyebrow">
                Case feedback
              </p>

              {/* Aesthetic subunits */}

              <div
                className={`subunit-feedback ${
                  grade?.subunits
                    ? "is-correct"
                    : "needs-review"
                }`}
              >

                <div className="subunit-feedback-heading">

                  <h3>
                    Aesthetic subunits
                  </h3>

                  {grade?.subunits ? (
                    <span className="correct">
                      Correct
                    </span>
                  ) : (
                    <span className="incorrect">
                      Review
                    </span>
                  )}

                </div>

                <p>
                  <strong>
                    Your answer:
                  </strong>{" "}
                  {formatSubunits(
                    answers.subunits
                  )}
                </p>

                <p>
                  <strong>
                    Correct answer:
                  </strong>{" "}
                  {formatSubunits(
                    current.answers
                      .subunits
                  )}
                </p>

              </div>

              {/* Structural reconstruction */}

              <div
                className={`subunit-feedback ${
                  grade?.structural
                    ? "is-correct"
                    : "needs-review"
                }`}
              >

                <div className="subunit-feedback-heading">

                  <h3>
                    Structural reconstruction
                  </h3>

                  {grade?.structural ? (
                    <span className="correct">
                      Correct
                    </span>
                  ) : (
                    <span className="incorrect">
                      Review
                    </span>
                  )}

                </div>

                <p>
                  <strong>
                    Your answer:
                  </strong>{" "}
                  {structuralLabel(
                    answers.structural
                  )}
                </p>

                <p>
                  <strong>
                    Correct answer:
                  </strong>{" "}
                  {structuralLabel(
                    current.answers
                      .structuralRequirement
                  )}
                </p>

              </div>

              {/* Preferred reconstruction */}

              <div
                className={`subunit-feedback ${
                  grade?.preferred
                    ? "is-correct"
                    : grade?.alternative
                      ? "is-acceptable"
                      : "needs-review"
                }`}
              >

                <div className="subunit-feedback-heading">

                  <h3>
                    Preferred reconstruction
                  </h3>

                  {grade?.preferred ? (
                    <span className="correct">
                      Correct
                    </span>
                  ) : grade?.alternative ? (
                    <span className="acceptable">
                      Acceptable alternative
                    </span>
                  ) : (
                    <span className="incorrect">
                      Review
                    </span>
                  )}

                </div>

                <p>
                  <strong>
                    Your answer:
                  </strong>{" "}
                  {reconstructionLabel(
                    answers.reconstruction
                  )}
                </p>

                <p>
                  <strong>
                    Preferred answer:
                  </strong>{" "}
                  {
                    current.feedback
                      .preferredLabel
                  }
                </p>

              </div>

              {/* Teaching explanation */}

              <h3>
                Preferred:{" "}
                {
                  current.feedback
                    .preferredLabel
                }
              </h3>

              <p>
                {
                  current.feedback
                    .preferredRationale
                }
              </p>

              {/* Acceptable alternatives */}

              {current.feedback
                .acceptableAlternatives
                .length > 0 && (
                <div className="alternatives">

                  <h4>
                    Acceptable alternatives
                  </h4>

                  {current.feedback
                    .acceptableAlternatives
                    .map((item) => (
                      <div
                        key={item.id}
                        className="alternative"
                      >
                        <span>
                          {item.label}
                        </span>
                      </div>
                    ))}

                </div>
              )}

              {/* Teaching pearl */}

              <div className="pearl">
                <strong>
                  Teaching pearl:
                </strong>{" "}
                {
                  current.feedback
                    .teachingPearl
                }
              </div>

              <div className="results-actions">

                <button
                  className="primary"
                  onClick={nextCase}
                >
                  Next case
                </button>

                <a
                  className="secondary-link"
                  href={feedbackFormUrl(
                    current.caseId
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Report an issue with{" "}
                  {displayCaseNumber(
                    current.caseId
                  )}{" "}
                  ↗
                </a>

              </div>

            </section>
          )}

        </article>

      </section>

      <footer className="site-footer">

        <p>
          Built by{" "}
          <strong>
            <a
              href="https://chrishornungmd.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chris Hornung, MD
            </a>
          </strong>
        </p>

        <p>
          Total cases submitted:{" "}
          {submittedCount.toLocaleString()}
        </p>
	<p>
          DISCLAIMER: All images in this app are AI generated or used from real patients with consent for use
        </p>

      </footer>

    </main>
  );
}

function Question({
  title,
  result,
  alternative,
  children,
}: {
  title: string;
  result?: boolean;
  alternative?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="question">

      <div className="question-title">

        <h3>
          {title}
        </h3>

        {result === true && (
          <span className="correct">
            Correct
          </span>
        )}

        {result === false &&
          alternative && (
            <span className="acceptable">
              Acceptable alternative
            </span>
          )}

        {result === false &&
          !alternative && (
            <span className="incorrect">
              Review
            </span>
          )}

      </div>

      {children}

    </section>
  );
}