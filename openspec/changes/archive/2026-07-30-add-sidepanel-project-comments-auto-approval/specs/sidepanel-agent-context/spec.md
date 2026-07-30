## Purpose

Define how a Side Panel conversation receives user-selected project and browser-page context without weakening filesystem, site-permission, tab-identity, or browser-control boundaries.

## ADDED Requirements

### Requirement: New conversations can use an optional project directory

PaneRelay SHALL let the user select or clear an optional project directory while the active tab workspace is still a draft, SHALL validate a selected directory through the local Native Host, and SHALL use it as the working directory when creating the provider conversation. The selected directory MUST remain context rather than a filesystem permission grant.

#### Scenario: Selecting a project directory

- **GIVEN** the active tab workspace is an unbound draft
- **WHEN** the user selects an existing directory in the system picker
- **THEN** the Side Panel shows the selected project and the first send creates the Agent conversation with that working directory

#### Scenario: Cancelling directory selection

- **GIVEN** an unbound draft already has or does not have a selected project
- **WHEN** the user cancels the system directory picker
- **THEN** PaneRelay preserves the draft and its prior project selection without creating a conversation

#### Scenario: Clearing a selected project

- **GIVEN** an unbound draft has a selected project
- **WHEN** the user clears that selection
- **THEN** the draft returns to the provider's default working directory without changing site authorization or browser control

#### Scenario: Project is immutable after conversation creation

- **GIVEN** the active workspace is bound to an Agent conversation
- **WHEN** the Side Panel renders the project control
- **THEN** it shows the bound working directory without allowing that conversation to be rebound to another directory

#### Scenario: Invalid project path fails closed

- **GIVEN** an Extension request supplies a missing, relative, or non-directory path
- **WHEN** the Bridge validates the requested working directory
- **THEN** PaneRelay rejects conversation creation and does not pass the path to an Agent provider

#### Scenario: Project selection does not grant filesystem access

- **GIVEN** a conversation was created with a selected project
- **WHEN** the Agent requests a command or file mutation in that project
- **THEN** the provider's sandbox and approval workflow still govern the request

### Requirement: New conversations receive bounded current-page metadata

PaneRelay SHALL orient a newly created Side Panel conversation with the active page URL and title captured for the first draft send, SHALL label those values as untrusted metadata, and MUST NOT expose a raw Chrome tab ID through the shared protocol, Agent prompt, provider metadata, or activity stream.

#### Scenario: First send includes current page context

- **GIVEN** an eligible active tab has a URL and title and its workspace is an unbound draft
- **WHEN** the user sends the first message
- **THEN** the new Agent conversation receives bounded URL and title metadata describing the current page

#### Scenario: Sensitive URL components are bounded

- **GIVEN** the active page URL contains a long value or a credential-like query or fragment value
- **WHEN** PaneRelay creates initial page context
- **THEN** it limits and redacts the URL before the value reaches the Agent provider

#### Scenario: Chrome tab identity stays private

- **GIVEN** a new conversation is bound to an Extension-private tab workspace
- **WHEN** PaneRelay creates its initial page context
- **THEN** the Agent receives no raw Chrome tab ID and browser actions continue to use existing opaque target discovery and authorization

#### Scenario: Page metadata is unavailable

- **GIVEN** Chrome cannot provide a readable URL or title for the active tab
- **WHEN** the first message creates a conversation
- **THEN** PaneRelay omits the unavailable metadata and continues without inventing values or widening authorization

### Requirement: Users can attach explicit page-element comments

PaneRelay SHALL provide a user-initiated comment workflow for an eligible authorized page, SHALL let the user create, edit, and remove multiple element comments or style annotations, and SHALL attach pending annotations to the next message as delimited untrusted page evidence. A single click on the comment control SHALL start one-shot selection, while a double click SHALL start continuous selection.

#### Scenario: Adding page comments

- **GIVEN** the active page has current PaneRelay site authorization
- **WHEN** the user single-clicks the comment control, selects an element, and confirms a comment or style annotation
- **THEN** PaneRelay marks the element with an editable pencil marker, shows a compact annotation pill in the Side Panel, and exits selection after that one annotation

#### Scenario: Adding several comments continuously

- **GIVEN** the active page has current PaneRelay site authorization
- **WHEN** the user double-clicks the comment control and confirms an annotation
- **THEN** PaneRelay preserves continuous selection so another element can be annotated until the user stops with the control, Escape, or right click

#### Scenario: Editing an annotation near its target

- **GIVEN** an element has a pending annotation
- **WHEN** the user selects the same element again, activates its pencil marker, or activates its Side Panel pill
- **THEN** PaneRelay opens the existing compact editor near the target instead of creating a duplicate annotation

#### Scenario: Previewing style annotations

- **GIVEN** the annotation editor is open for an element
- **WHEN** the user expands style settings and changes supported text or CSS properties
- **THEN** PaneRelay offers direct color selection alongside editable CSS values, previews the requested values on the page, records only requested changes, restores the original page on cancel, and keeps the preview visible after confirmation as temporary evidence

#### Scenario: Comment editor follows the target and Side Panel theme

- **GIVEN** the user selects an element in page-comment mode
- **WHEN** PaneRelay opens or expands the comment editor, the target moves, the page scrolls, or the visual viewport changes
- **THEN** the editor uses the resolved Side Panel light or dark palette, anchors beside the target with viewport-edge avoidance, and remains inside the visible viewport without covering the target when another placement is available

#### Scenario: Selection moves between elements

- **GIVEN** page-comment selection is active and motion is not reduced
- **WHEN** the pointer or touch selection moves from one eligible element to another
- **THEN** PaneRelay animates the existing highlight between element bounds instead of replacing it without a transition

#### Scenario: Selecting an element in mobile emulation

- **GIVEN** page-comment selection is active in a coarse-pointer or mobile-emulated viewport
- **WHEN** the user drags a touch to highlight an element and releases it
- **THEN** PaneRelay prevents accidental page scrolling during selection, identifies the element under the touch point, opens touch-sized controls inside the visual viewport, and restores normal page touch behavior when selection pauses or ends

#### Scenario: Selecting an element inside an iframe

- **GIVEN** page-comment selection is active and an iframe is reachable under the current Chrome site authorization
- **WHEN** the user moves selection into the iframe and confirms an element comment or style annotation
- **THEN** PaneRelay keeps only that frame's picker highlight active, anchors the editor and marker inside that frame, and records bounded frame URL, title, and viewport evidence without exposing a raw Chrome frame ID

#### Scenario: An iframe is not authorized or injectable

- **GIVEN** a page contains a frame whose origin is outside current Chrome site authorization or which Chrome does not permit the Extension to access
- **WHEN** page-comment mode starts
- **THEN** PaneRelay leaves that frame untouched while keeping comments available in authorized reachable frames and does not treat the inaccessible frame as selected evidence

#### Scenario: Editing and removing pending comments

- **GIVEN** one or more pending page comments exist
- **WHEN** the user edits a marker or removes a comment from the Side Panel
- **THEN** the page marker and pending-comment list reflect the same updated set, and removing the comment currently being edited closes its editor and target highlight while restoring the original page styles

#### Scenario: Sending page comments

- **GIVEN** pending page comments exist
- **WHEN** the user sends a message, including an otherwise empty request
- **THEN** PaneRelay sends bounded element identification, top-page metadata, optional selected-frame metadata, and user comment text as untrusted context and clears the comments only after the Agent accepts the send

#### Scenario: Comment send fails

- **GIVEN** pending comments are included in a send
- **WHEN** conversation creation or message sending fails
- **THEN** PaneRelay preserves the pending comments and page markers so the user can retry

#### Scenario: Unauthorized page comment fails closed

- **GIVEN** the active tab lacks current PaneRelay site authorization or is a restricted Chrome page
- **WHEN** the user attempts to enable page-comment mode
- **THEN** PaneRelay refuses to inject or activate the comment runtime and explains that page authorization is required

#### Scenario: Page lifecycle ends comment mode

- **GIVEN** page-comment mode or pending comments belong to one tab document
- **WHEN** that document navigates, the tab closes, the active workspace changes to an unrelated tab, or its site authorization is revoked
- **THEN** PaneRelay ends the comment mode and does not silently attach those comments to another page or conversation

### Requirement: Users can paste bounded images into the composer

PaneRelay SHALL accept PNG, JPEG, WebP, and GIF files pasted from the clipboard into the composer, SHALL show removable previews before send, and SHALL send the images only to providers that advertise image-input support. PaneRelay MUST accept at most four images, at most 10 MiB per image, and at most 20 MiB in total, and MUST validate the same bounds again at the Bridge boundary.

#### Scenario: Pasting and sending images

- **GIVEN** the selected provider supports image input
- **WHEN** the user pastes one or more supported images into the composer
- **THEN** PaneRelay shows thumbnail previews and allows a text-plus-image or image-only send

#### Scenario: Plain text paste remains native

- **GIVEN** the clipboard contains no image files
- **WHEN** the user pastes into the composer
- **THEN** PaneRelay leaves the browser's ordinary text paste behavior unchanged

#### Scenario: Removing a pasted image

- **GIVEN** one or more image previews are pending
- **WHEN** the user removes a preview
- **THEN** the corresponding image is excluded from the next send without changing the draft text or page annotations

#### Scenario: Unsupported or oversized image fails locally

- **GIVEN** an image has an unsupported MIME type or exceeds a count, per-image, or aggregate bound
- **WHEN** the user pastes it
- **THEN** PaneRelay rejects that image, reports the applicable limit, and preserves already accepted images

#### Scenario: Provider does not support images

- **GIVEN** the selected provider reports image input as unsupported
- **WHEN** the user pastes an image
- **THEN** PaneRelay refuses the image without converting it into page text or sending its bytes

#### Scenario: Image send fails

- **GIVEN** pending images are included in a send
- **WHEN** conversation creation or message sending fails
- **THEN** PaneRelay preserves the draft text, image previews, and page annotations so the user can retry

### Requirement: Context never grants browser ownership

Project selection, initial page context, page comments, tab focus, and conversation bindings SHALL NOT authorize a site, acquire or renew a browser-control lease, hand control to an Agent, or permit an unauthorized browser mutation.

#### Scenario: Context exists without a control lease

- **GIVEN** a conversation has project or page context but no current browser-control lease
- **WHEN** the Agent attempts a mutating browser action
- **THEN** the action fails under the existing control policy while non-browser conversation context remains available
