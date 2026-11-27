# DeclareFX

DeclareFX connects declarative effect interfaces with hand-written audio processing.

## Language

**Parameter**:
A persistent effect value exposed to host automation. A parameter is distinct from the control used to edit it.
_Avoid_: Control value, UI state

**Control**:
A visual editor for a parameter. Multiple controls may refer to the same parameter without owning separate parameter values.
_Avoid_: Parameter, slider when referring to a custom visual editor

**UI gesture**:
A single control interaction spanning its start, any value changes, and its end. Gesture state is transient, not a saved parameter value.
_Avoid_: Automation mode

**Parameter binding**:
An explicit association between an effect parameter, authored state, and a visual control. The association does not create another authoritative parameter value.
_Avoid_: Two-way binding when referring to native host integration
