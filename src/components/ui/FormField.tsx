"use client";

import { ReactNode, useId } from "react";
import { Info } from "lucide-react";

export default function FormField(props: {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  hintRight?: ReactNode; // e.g. inline link or button

  children: (args: { id: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const helpId = props.helpText ? `${id}-help` : undefined;
  const errId = props.error ? `${id}-err` : undefined;

  const describedBy = [helpId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="mwField">
      <div className="mwFieldTop">
        <label className="mwFieldLabel" htmlFor={id}>
          {props.label}
          {props.required ? <span className="mwReq">*</span> : null}
        </label>
        {props.hintRight ? <div className="mwFieldHintRight">{props.hintRight}</div> : null}
      </div>

      <div className="mwFieldControl">{props.children({ id, describedBy })}</div>

      {props.helpText ? (
        <div id={helpId} className="mwFieldHelp">
          <Info size={14} style={{ opacity: 0.75 }} />
          <span>{props.helpText}</span>
        </div>
      ) : null}

      {props.error ? (
        <div id={errId} className="mwFieldError" role="alert">
          {props.error}
        </div>
      ) : null}
    </div>
  );
}
