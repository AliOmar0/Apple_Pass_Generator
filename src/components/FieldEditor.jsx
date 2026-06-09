import { GripVertical, Plus, Trash2 } from "lucide-react";

const TITLES = {
  header: "Header fields",
  primary: "Primary fields",
  secondary: "Secondary fields",
  auxiliary: "Auxiliary fields",
  back: "Back of pass",
};

export default function FieldEditor({ group, fields, onChange }) {
  const updateField = (index, property, value) => {
    const next = fields.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [property]: value } : item,
    );
    onChange(next);
  };

  const addField = () => {
    const index = fields.length + 1;
    onChange([
      ...fields,
      { key: `${group}_${Date.now()}`, label: `LABEL ${index}`, value: "New value" },
    ]);
  };

  const removeField = (index) => {
    onChange(fields.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="field-section">
      <div className="section-heading">
        <div>
          <h3>{TITLES[group]}</h3>
          <p>{group === "back" ? "Shown after tapping pass details." : "Displayed on the front of the pass."}</p>
        </div>
        <button className="icon-button" type="button" onClick={addField} aria-label={`Add ${group} field`}>
          <Plus size={17} />
        </button>
      </div>

      <div className="field-list">
        {fields.map((item, index) => (
          <div className="field-row" key={item.key}>
            <GripVertical className="drag-icon" size={17} />
            <div className="field-inputs">
              <input
                aria-label={`${group} field label`}
                value={item.label}
                onChange={(event) => updateField(index, "label", event.target.value)}
                placeholder="Label"
              />
              <input
                aria-label={`${group} field value`}
                value={item.value}
                onChange={(event) => updateField(index, "value", event.target.value)}
                placeholder="Value"
              />
            </div>
            <button
              className="remove-button"
              type="button"
              onClick={() => removeField(index)}
              aria-label={`Remove ${item.label}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
