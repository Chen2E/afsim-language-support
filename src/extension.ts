import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Extension activation
// =============================================================================

export function activate(context: vscode.ExtensionContext) {
    const completionProvider = new WsfCompletionProvider();
    const hoverProvider = new WsfHoverProvider();
    const linkProvider = new WsfIncludeLinkProvider();
    const definitionProvider = new WsfDefinitionProvider();

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'wsf',
            completionProvider,
            '.', '-', '(', ' '
        ),
        vscode.languages.registerHoverProvider('wsf', hoverProvider),
        vscode.languages.registerDocumentLinkProvider('wsf', linkProvider),
        vscode.languages.registerDefinitionProvider('wsf', definitionProvider)
    );

    // Auto-detect WSF files by content when a .txt file is opened
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (doc) => {
            if (doc.languageId !== 'plaintext' && doc.languageId !== 'txt') { return; }
            const firstLine = doc.lineAt(0).text;
            if (/^# \*{5,}/.test(firstLine) ||
                /^(file_path|include_once|include|platform_type|platform|simulation|define_path_variable|log_file|random_seed|end_time)\b/.test(firstLine)) {
                await vscode.languages.setTextDocumentLanguage(doc, 'wsf');
            }
        })
    );
}

export function deactivate() {}

// =============================================================================
// Helper: create a CompletionItem
// =============================================================================

function ci(
    label: string,
    detail: string,
    kind: vscode.CompletionItemKind,
    insertText?: string
): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, kind);
    item.detail = detail;
    if (insertText) {
        item.insertText = new vscode.SnippetString(insertText);
    }
    return item;
}

function methodCI(m: MethodInfo, kind: vscode.CompletionItemKind): vscode.CompletionItem {
    const item = new vscode.CompletionItem({
        label: m.name,
        description: m.description,
    }, kind);
    item.detail = m.signature;
    item.insertText = new vscode.SnippetString(
        m.signature.includes('(')
            ? m.signature.replace('(', '(${0}')
            : m.name
    );
    return item;
}

interface MethodInfo {
    name: string;
    signature: string;
    description: string;
}

// =============================================================================
// Keywords
// =============================================================================

const keywords: vscode.CompletionItem[] = [
    // Control flow
    ci('if', 'If statement', vscode.CompletionItemKind.Keyword,
       'if (${1:condition}) {\n   ${2}\n}'),
    ci('else', 'Else clause', vscode.CompletionItemKind.Keyword),
    ci('else if', 'Else-if clause', vscode.CompletionItemKind.Keyword,
       'else if (${1:condition}) {\n   ${2}\n}'),
    ci('for', 'For loop', vscode.CompletionItemKind.Keyword,
       'for (${1:int i = 0}; ${2:i < n}; ${3:i += 1}) {\n   ${4}\n}'),
    ci('foreach', 'Foreach loop', vscode.CompletionItemKind.Keyword,
       'foreach (${1:type} ${2:var} in ${3:container}) {\n   ${4}\n}'),
    ci('while', 'While loop', vscode.CompletionItemKind.Keyword,
       'while (${1:condition}) {\n   ${2}\n}'),
    ci('do', 'Do-while loop', vscode.CompletionItemKind.Keyword,
       'do {\n   ${1}\n} while (${2:condition});'),
    ci('break', 'Break out of loop', vscode.CompletionItemKind.Keyword),
    ci('continue', 'Continue to next iteration', vscode.CompletionItemKind.Keyword),
    ci('return', 'Return from function', vscode.CompletionItemKind.Keyword,
       'return ${1:value};'),
    ci('in', 'In operator (used in foreach)', vscode.CompletionItemKind.Keyword),
    ci('when', 'When clause for state/phase transitions', vscode.CompletionItemKind.Keyword),

    // Modifiers
    ci('global', 'Global variable modifier', vscode.CompletionItemKind.Keyword),
    ci('static', 'Static variable modifier', vscode.CompletionItemKind.Keyword),
    ci('extern', 'External function declaration', vscode.CompletionItemKind.Keyword,
       'extern ${1:void} ${2:funcName}(${3});'),

    // Toggle / enable-disable
    ci('on', 'Turn on component', vscode.CompletionItemKind.Keyword),
    ci('off', 'Turn off component', vscode.CompletionItemKind.Keyword),
    ci('enable', 'Enable feature', vscode.CompletionItemKind.Keyword),
    ci('disable', 'Disable feature', vscode.CompletionItemKind.Keyword),

    // Constants
    ci('true', 'Boolean true', vscode.CompletionItemKind.Constant),
    ci('false', 'Boolean false', vscode.CompletionItemKind.Constant),
    ci('null', 'Null value', vscode.CompletionItemKind.Constant),
];

// =============================================================================
// Built-in variables
// =============================================================================

const builtInVars: vscode.CompletionItem[] = [
    ci('PLATFORM', 'Current WsfPlatform reference', vscode.CompletionItemKind.Variable),
    ci('PROCESSOR', 'Current WsfProcessor reference', vscode.CompletionItemKind.Variable),
    ci('TRACK', 'Current WsfTrack reference (in task/state processors)', vscode.CompletionItemKind.Variable),
    ci('TIME_NOW', 'Current simulation time (double)', vscode.CompletionItemKind.Variable),
    ci('MESSAGE', 'Message object in on_message blocks (cast to specific type)', vscode.CompletionItemKind.Variable),
    ci('SELF', 'Self role identifier in command chains', vscode.CompletionItemKind.Variable),
];

// =============================================================================
// Types
// =============================================================================

const types: vscode.CompletionItem[] = [
    // Primitive
    ci('void', 'Void type (no return value)', vscode.CompletionItemKind.TypeParameter),
    ci('string', 'String type', vscode.CompletionItemKind.TypeParameter),
    ci('int', 'Integer type', vscode.CompletionItemKind.TypeParameter),
    ci('double', 'Double-precision float type', vscode.CompletionItemKind.TypeParameter),
    ci('char', 'Character type', vscode.CompletionItemKind.TypeParameter),
    ci('bool', 'Boolean type', vscode.CompletionItemKind.TypeParameter),
    ci('var', 'Variant type', vscode.CompletionItemKind.TypeParameter),
    ci('Object', 'Base object type', vscode.CompletionItemKind.TypeParameter),
    ci('struct', 'Dynamic struct type', vscode.CompletionItemKind.TypeParameter),

    // Container
    ci('Array', 'Array<T> container type', vscode.CompletionItemKind.Class,
       'Array<${1:type}>'),
    ci('Map', 'Map<K,V> container type', vscode.CompletionItemKind.Class,
       'Map<${1:keyType}, ${2:valueType}>'),
    ci('Set', 'Set<T> container type', vscode.CompletionItemKind.Class,
       'Set<${1:type}>'),

    // Domain types
    ci('WsfPlatform', 'Platform simulation object', vscode.CompletionItemKind.Class),
    ci('WsfProcessor', 'Processor on a platform', vscode.CompletionItemKind.Class),
    ci('WsfSensor', 'Sensor on a platform', vscode.CompletionItemKind.Class),
    ci('WsfWeapon', 'Weapon on a platform', vscode.CompletionItemKind.Class),
    ci('WsfRoute', 'Route with waypoints', vscode.CompletionItemKind.Class),
    ci('WsfWaypoint', 'Waypoint in a route', vscode.CompletionItemKind.Class),
    ci('WsfTrack', 'Track (detected object)', vscode.CompletionItemKind.Class),
    ci('WsfPlatformPart', 'Platform part base type', vscode.CompletionItemKind.Class),
    ci('WsfArticulatedPart', 'Articulated part type', vscode.CompletionItemKind.Class),
    ci('WsfWeaponEngagement', 'Weapon engagement object', vscode.CompletionItemKind.Class),
    ci('WsfLocalTrack', 'Local track object', vscode.CompletionItemKind.Class),
    ci('WsfRIPRJob', 'RIPR scheduling job', vscode.CompletionItemKind.Class),
    ci('WsfRIPRProcessor', 'RIPR scheduling processor', vscode.CompletionItemKind.Class),
    ci('WsfSimulation', 'Global simulation access (static)', vscode.CompletionItemKind.Class),

    // New types from demos
    ci('WsfComm', 'Communication device on a platform', vscode.CompletionItemKind.Class),
    ci('WsfCommandChain', 'Command chain (hierarchy) structure', vscode.CompletionItemKind.Class),
    ci('WsfGeoPoint', 'Geographic point (lat/lon/alt)', vscode.CompletionItemKind.Class),
    ci('WsfFuel', 'Fuel system on a platform', vscode.CompletionItemKind.Class),
    ci('WsfDraw', 'Drawing utilities for visualization', vscode.CompletionItemKind.Class),
    ci('WsfRouteFinder', 'Route planning/finding utility', vscode.CompletionItemKind.Class),
    ci('WsfTrackMessage', 'Track message (received via on_message)', vscode.CompletionItemKind.Class),
    ci('WsfVideoMessage', 'Video message type', vscode.CompletionItemKind.Class),
    ci('WsfSensorInteraction', 'Sensor interaction result', vscode.CompletionItemKind.Class),
    ci('WsfLocalTrackList', 'Local track list container', vscode.CompletionItemKind.Class),
    ci('WsfTrackId', 'Track identifier (platform + number)', vscode.CompletionItemKind.Class),
    ci('FileIO', 'File I/O utility class', vscode.CompletionItemKind.Class),
    ci('Vec3', '3D vector (static methods)', vscode.CompletionItemKind.Class),
    ci('MATH', 'Math utilities (static class)', vscode.CompletionItemKind.Class),
    ci('Format', 'Formatting utilities (static class)', vscode.CompletionItemKind.Class),
    ci('ArrayIterator', 'Array iterator for while loops', vscode.CompletionItemKind.Class),
];

// =============================================================================
// Global functions
// =============================================================================

const globalFunctions: MethodInfo[] = [
    { name: 'attr_count', signature: 'attr_count(object)', description: 'Returns the number of attributes on an object' },
    { name: 'attr_name_at', signature: 'attr_name_at(object, index)', description: 'Returns the attribute name at the given index' },
    { name: 'get_attr', signature: 'get_attr(object, name)', description: 'Returns the attribute value by name' },
    { name: 'write_str', signature: 'write_str(value)', description: 'Converts a value to string for debug output' },
    { name: 'writeln', signature: 'writeln(args...)', description: 'Writes a line of debug output' },
    { name: 'writeln_d', signature: 'writeln_d(args...)', description: 'Writes debug output line (only when debug enabled)' },
    { name: 'FireAt', signature: 'FireAt(track, taskStr, weapon, salvoSize)', description: 'Fires a weapon at a track' },
    { name: 'SelectPhase', signature: 'SelectPhase(name)', description: 'Switches to the named guidance phase' },
    { name: 'SetCommandedAltitudeAGL', signature: 'SetCommandedAltitudeAGL(alt)', description: 'Sets commanded altitude AGL' },
    { name: 'SetAllowRouteFollowing', signature: 'SetAllowRouteFollowing(bool)', description: 'Enables/disables route following' },
    { name: 'FollowRoute', signature: 'FollowRoute(name)', description: 'Commands platform to follow a named route' },
];

// =============================================================================
// Static class methods
// =============================================================================

const mathMethods: MethodInfo[] = [
    { name: 'M_PER_FT', signature: 'M_PER_FT()', description: 'Meters per foot conversion factor' },
    { name: 'FT_PER_M', signature: 'FT_PER_M()', description: 'Feet per meter conversion factor' },
    { name: 'M_PER_NM', signature: 'M_PER_NM()', description: 'Meters per nautical mile' },
    { name: 'NM_PER_M', signature: 'NM_PER_M()', description: 'Nautical miles per meter' },
    { name: 'NMPH_PER_MPS', signature: 'NMPH_PER_MPS()', description: 'Nautical miles per hour per m/s' },
    { name: 'MPS_PER_NMPH', signature: 'MPS_PER_NMPH()', description: 'Meters per second per nautical mph' },
    { name: 'Sin', signature: 'Sin(x)', description: 'Sine of angle in radians' },
    { name: 'Cos', signature: 'Cos(x)', description: 'Cosine of angle in radians' },
    { name: 'Tan', signature: 'Tan(x)', description: 'Tangent of angle in radians' },
    { name: 'ASin', signature: 'ASin(x)', description: 'Arc sine (returns radians)' },
    { name: 'ACos', signature: 'ACos(x)', description: 'Arc cosine (returns radians)' },
    { name: 'ATan', signature: 'ATan(x)', description: 'Arc tangent (returns radians)' },
    { name: 'ATan2', signature: 'ATan2(y, x)', description: 'Arc tangent of y/x (returns radians)' },
    { name: 'Sqrt', signature: 'Sqrt(x)', description: 'Square root' },
    { name: 'Pow', signature: 'Pow(x, y)', description: 'Power function (x^y)' },
    { name: 'Max', signature: 'Max(a, b)', description: 'Maximum of two values' },
    { name: 'Min', signature: 'Min(a, b)', description: 'Minimum of two values' },
    { name: 'Abs', signature: 'Abs(x)', description: 'Integer absolute value' },
    { name: 'Fabs', signature: 'Fabs(x)', description: 'Floating-point absolute value' },
    { name: 'RandomUniform', signature: 'RandomUniform()', description: 'Random number between 0 and 1' },
    { name: 'RandomGaussian', signature: 'RandomGaussian(mean, stddev)', description: 'Gaussian random number' },
    { name: 'NormalizeAngle0_360', signature: 'NormalizeAngle0_360(angle)', description: 'Normalize angle to [0, 360)' },
];

const vec3Methods: MethodInfo[] = [
    { name: 'Construct', signature: 'Construct(x, y, z)', description: 'Creates a Vec3 from components' },
    { name: 'Subtract', signature: 'Subtract(a, b)', description: 'Subtracts vector b from a' },
    { name: 'Add', signature: 'Add(a, b)', description: 'Adds two vectors' },
    { name: 'Dot', signature: 'Dot(a, b)', description: 'Dot product of two vectors' },
    { name: 'Cross', signature: 'Cross(a, b)', description: 'Cross product of two vectors' },
    { name: 'Normalize', signature: 'Normalize(v)', description: 'Returns normalized vector' },
    { name: 'Magnitude', signature: 'Magnitude(v)', description: 'Returns vector magnitude' },
    { name: 'Scale', signature: 'Scale(v, s)', description: 'Scales vector by scalar' },
];

const formatMethods: MethodInfo[] = [
    { name: 'Fixed', signature: 'Fixed(value, precision)', description: 'Formats as fixed-point decimal string' },
    { name: 'Scientific', signature: 'Scientific(value, precision)', description: 'Formats as scientific notation string' },
    { name: 'Integer', signature: 'Integer(value)', description: 'Formats as integer string' },
];

const simMethods: MethodInfo[] = [
    { name: 'FindPlatform', signature: 'FindPlatform(nameOrIndex)', description: 'Finds a platform by name or index' },
    { name: 'PlatformCount', signature: 'PlatformCount()', description: 'Returns the total number of platforms' },
    { name: 'PlatformEntry', signature: 'PlatformEntry(index)', description: 'Returns the platform at the given index' },
    { name: 'RandomSeed', signature: 'RandomSeed()', description: 'Returns the simulation random seed' },
    { name: 'EndTime', signature: 'EndTime()', description: 'Returns the simulation end time' },
    { name: 'CreatePlatform', signature: 'CreatePlatform(typeName)', description: 'Creates a new platform of the given type' },
];

const structMethods: MethodInfo[] = [
    { name: 'New', signature: 'New("TypeName")', description: 'Creates a new struct instance of the named type' },
];

const fileIOMethods: MethodInfo[] = [
    { name: 'Open', signature: 'Open(path, mode)', description: 'Opens a file (mode: "r", "w", "a")' },
    { name: 'Close', signature: 'Close()', description: 'Closes the file' },
    { name: 'Write', signature: 'Write(str)', description: 'Writes a string to the file' },
    { name: 'WriteLine', signature: 'WriteLine(str)', description: 'Writes a line to the file (with newline)' },
    { name: 'ReadLine', signature: 'ReadLine()', description: 'Reads the next line from the file' },
    { name: 'IsOpen', signature: 'IsOpen()', description: 'Returns true if file is currently open' },
];

// =============================================================================
// Type instance methods
// =============================================================================

const typeMethods: Record<string, MethodInfo[]> = {
    // ---- Container methods ----
    'array': [
        { name: 'Size', signature: 'Size()', description: 'Returns the number of elements' },
        { name: 'Empty', signature: 'Empty()', description: 'Returns true if array is empty' },
        { name: 'Back', signature: 'Back()', description: 'Returns the last element' },
        { name: 'PopBack', signature: 'PopBack()', description: 'Removes the last element' },
        { name: 'PushBack', signature: 'PushBack(value)', description: 'Adds an element to the end' },
        { name: 'Clear', signature: 'Clear()', description: 'Removes all elements' },
        { name: 'GetIterator', signature: 'GetIterator()', description: 'Returns an ArrayIterator for the array' },
    ],
    'map': [
        { name: 'Size', signature: 'Size()', description: 'Returns the number of key-value pairs' },
        { name: 'Empty', signature: 'Empty()', description: 'Returns true if map is empty' },
        { name: 'Clear', signature: 'Clear()', description: 'Removes all entries' },
        { name: 'ElementKeyAtIndex', signature: 'ElementKeyAtIndex(index)', description: 'Returns the key at the given index' },
    ],
    'set': [
        { name: 'Size', signature: 'Size()', description: 'Returns the number of elements' },
        { name: 'Empty', signature: 'Empty()', description: 'Returns true if set is empty' },
        { name: 'Clear', signature: 'Clear()', description: 'Removes all elements' },
    ],

    // ---- WsfPlatform ----
    'wsfplatform': [
        { name: 'Name', signature: 'Name()', description: 'Returns the platform name' },
        { name: 'Side', signature: 'Side()', description: 'Returns the platform side' },
        { name: 'Type', signature: 'Type()', description: 'Returns the platform type' },
        { name: 'IsNull', signature: 'IsNull()', description: 'Returns true if platform is null' },
        { name: 'IsValid', signature: 'IsValid()', description: 'Returns true if platform is valid' },
        { name: 'ProcessorCount', signature: 'ProcessorCount()', description: 'Returns the number of processors' },
        { name: 'ProcessorEntry', signature: 'ProcessorEntry(index)', description: 'Returns the processor at the given index' },
        { name: 'SensorCount', signature: 'SensorCount()', description: 'Returns the number of sensors' },
        { name: 'SensorEntry', signature: 'SensorEntry(index)', description: 'Returns the sensor at the given index' },
        { name: 'WeaponCount', signature: 'WeaponCount()', description: 'Returns the number of weapons' },
        { name: 'WeaponEntry', signature: 'WeaponEntry(index)', description: 'Returns the weapon at the given index' },
        { name: 'CommCount', signature: 'CommCount()', description: 'Returns the number of comm devices' },
        { name: 'CommEntry', signature: 'CommEntry(index)', description: 'Returns the comm device at the given index' },
        { name: 'CommandChainCount', signature: 'CommandChainCount()', description: 'Returns the number of command chains' },
        { name: 'CommandChainEntry', signature: 'CommandChainEntry(index)', description: 'Returns the command chain at the given index' },
        { name: 'ZoneNames', signature: 'ZoneNames()', description: 'Returns array of zone names' },
        { name: 'Zone', signature: 'Zone(name)', description: 'Returns the zone with the given name' },
        { name: 'Route', signature: 'Route()', description: 'Returns the platform route' },
        { name: 'Location', signature: 'Location()', description: 'Returns platform location as WsfGeoPoint' },
        { name: 'Latitude', signature: 'Latitude()', description: 'Returns latitude in degrees' },
        { name: 'Longitude', signature: 'Longitude()', description: 'Returns longitude in degrees' },
        { name: 'Altitude', signature: 'Altitude()', description: 'Returns current altitude' },
        { name: 'X', signature: 'X()', description: 'Returns X position' },
        { name: 'Y', signature: 'Y()', description: 'Returns Y position' },
        { name: 'Z', signature: 'Z()', description: 'Returns Z position' },
        { name: 'Heading', signature: 'Heading()', description: 'Returns current heading (degrees)' },
        { name: 'Speed', signature: 'Speed()', description: 'Returns current speed' },
        { name: 'MachNumber', signature: 'MachNumber()', description: 'Returns current Mach number' },
        { name: 'VelocityWCS', signature: 'VelocityWCS()', description: 'Returns velocity as Vec3 in world coordinate system' },
        { name: 'LocationWCS', signature: 'LocationWCS()', description: 'Returns WCS location as Vec3' },
        { name: 'TimeSinceCreation', signature: 'TimeSinceCreation()', description: 'Returns time since platform was created' },
        { name: 'MasterTrackList', signature: 'MasterTrackList()', description: 'Returns WsfLocalTrackList for this platform' },
        { name: 'Fuel', signature: 'Fuel()', description: 'Returns WsfFuel for this platform' },
        { name: 'CommanderName', signature: 'CommanderName()', description: 'Returns the commander name' },
        { name: 'SlantRangeTo', signature: 'SlantRangeTo(target)', description: 'Returns slant range to target' },
        { name: 'GroundRangeTo', signature: 'GroundRangeTo(target)', description: 'Returns ground range to target' },
        { name: 'TrueBearingTo', signature: 'TrueBearingTo(target)', description: 'Returns true bearing to target' },
        { name: 'RelativeBearingTo', signature: 'RelativeBearingTo(target)', description: 'Returns relative bearing to target' },
        { name: 'ClosingSpeedOf', signature: 'ClosingSpeedOf(target)', description: 'Returns closing speed to target (m/s)' },
        { name: 'RelativeAzimuthOf', signature: 'RelativeAzimuthOf(target)', description: 'Returns relative azimuth to target' },
        { name: 'RelativeElevationOf', signature: 'RelativeElevationOf(target)', description: 'Returns relative elevation to target' },
        { name: 'MakeTrack', signature: 'MakeTrack()', description: 'Creates a WsfTrack for this platform' },
        { name: 'TurnToHeading', signature: 'TurnToHeading(heading)', description: 'Commands turn to specified heading' },
        { name: 'GoToAltitude', signature: 'GoToAltitude(alt)', description: 'Commands altitude change' },
        { name: 'GoToSpeed', signature: 'GoToSpeed(speed)', description: 'Commands speed change' },
        { name: 'GoToLocation', signature: 'GoToLocation(lat, lon)', description: 'Commands location change' },
        { name: 'ReturnToRoute', signature: 'ReturnToRoute()', description: 'Returns to following the assigned route' },
        { name: 'SetRoute', signature: 'SetRoute(route)', description: 'Sets a new route for the platform' },
        { name: 'FollowRoute', signature: 'FollowRoute(name)', description: 'Follows a named predefined route' },
        { name: 'TurnSensorOn', signature: 'TurnSensorOn(name)', description: 'Turns on a sensor by name' },
        { name: 'TurnOn', signature: 'TurnOn()', description: 'Turns on the component' },
        { name: 'TurnOff', signature: 'TurnOff()', description: 'Turns off the component' },
        { name: 'CurrentTargetTrack', signature: 'CurrentTargetTrack()', description: 'Returns the current target WsfTrack' },
        { name: 'TargetName', signature: 'TargetName()', description: 'Returns the target name' },
        { name: 'Comment', signature: 'Comment(text)', description: 'Adds a comment to the platform' },
        { name: 'AuxDataString', signature: 'AuxDataString(name)', description: 'Returns aux data string value' },
        { name: 'AuxDataInt', signature: 'AuxDataInt(name)', description: 'Returns aux data int value' },
        { name: 'AuxDataDouble', signature: 'AuxDataDouble(name)', description: 'Returns aux data double value' },
        { name: 'AuxDataBool', signature: 'AuxDataBool(name)', description: 'Returns aux data bool value' },
        { name: 'GetAllAuxDataTypes', signature: 'GetAllAuxDataTypes()', description: 'Returns map of aux data names to types' },
    ],

    // ---- WsfProcessor ----
    'wsfprocessor': [
        { name: 'Name', signature: 'Name()', description: 'Returns the processor name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the processor type' },
        { name: 'IsTurnedOn', signature: 'IsTurnedOn()', description: 'Returns true if processor is turned on' },
        { name: 'IsOperational', signature: 'IsOperational()', description: 'Returns true if processor is operational' },
        { name: 'TurnOn', signature: 'TurnOn()', description: 'Turns on the processor' },
        { name: 'TurnOff', signature: 'TurnOff()', description: 'Turns off the processor' },
        { name: 'UpdateInterval', signature: 'UpdateInterval()', description: 'Returns the update interval' },
    ],

    // ---- WsfPlatformPart ----
    'wsfplatformpart': [
        { name: 'Name', signature: 'Name()', description: 'Returns the part name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the part type' },
        { name: 'IsTurnedOn', signature: 'IsTurnedOn()', description: 'Returns true if part is turned on' },
        { name: 'IsOperational', signature: 'IsOperational()', description: 'Returns true if part is operational' },
        { name: 'CurrentMode', signature: 'CurrentMode()', description: 'Returns the current mode name' },
    ],

    // ---- WsfSensor ----
    'wsfsensor': [
        { name: 'Name', signature: 'Name()', description: 'Returns the sensor name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the sensor type' },
        { name: 'IsTurnedOn', signature: 'IsTurnedOn()', description: 'Returns true if sensor is turned on' },
        { name: 'IsOperational', signature: 'IsOperational()', description: 'Returns true if sensor is operational' },
        { name: 'CurrentMode', signature: 'CurrentMode()', description: 'Returns the current mode name' },
        { name: 'TurnOn', signature: 'TurnOn()', description: 'Turns on the sensor' },
        { name: 'TurnOff', signature: 'TurnOff()', description: 'Turns off the sensor' },
    ],

    // ---- WsfWeapon ----
    'wsfweapon': [
        { name: 'Name', signature: 'Name()', description: 'Returns the weapon name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the weapon type' },
        { name: 'QuantityRemaining', signature: 'QuantityRemaining()', description: 'Returns remaining quantity' },
        { name: 'FireSalvo', signature: 'FireSalvo(track, count)', description: 'Fires a salvo at a track' },
        { name: 'Fire', signature: 'Fire(track)', description: 'Fires a single round at a track' },
        { name: 'TimeSinceLastFired', signature: 'TimeSinceLastFired()', description: 'Returns time since last firing' },
        { name: 'FiringInterval', signature: 'FiringInterval()', description: 'Returns the firing interval' },
    ],

    // ---- WsfWaypoint ----
    'wsfwaypoint': [
        { name: 'Location', signature: 'Location()', description: 'Returns the waypoint location' },
        { name: 'Speed', signature: 'Speed()', description: 'Returns the waypoint speed' },
        { name: 'Heading', signature: 'Heading()', description: 'Returns the waypoint heading' },
        { name: 'Switch', signature: 'Switch()', description: 'Returns the switch behavior' },
        { name: 'Label', signature: 'Label()', description: 'Returns the waypoint label' },
        { name: 'GoToLabel', signature: 'GoToLabel()', description: 'Returns the goto label' },
        { name: 'AuxDataString', signature: 'AuxDataString(name)', description: 'Returns aux data string value' },
        { name: 'AuxDataInt', signature: 'AuxDataInt(name)', description: 'Returns aux data int value' },
        { name: 'AuxDataDouble', signature: 'AuxDataDouble(name)', description: 'Returns aux data double value' },
        { name: 'AuxDataBool', signature: 'AuxDataBool(name)', description: 'Returns aux data bool value' },
        { name: 'GetAllAuxDataTypes', signature: 'GetAllAuxDataTypes()', description: 'Returns map of aux data names to types' },
    ],

    // ---- WsfRoute ----
    'wsfroute': [
        { name: 'Size', signature: 'Size()', description: 'Returns the number of waypoints' },
        { name: 'Waypoint', signature: 'Waypoint(index)', description: 'Returns the waypoint at the given index' },
        { name: 'IsValid', signature: 'IsValid()', description: 'Returns true if route is valid' },
        { name: 'AuxDataString', signature: 'AuxDataString(name)', description: 'Returns aux data string value' },
        { name: 'AuxDataInt', signature: 'AuxDataInt(name)', description: 'Returns aux data int value' },
        { name: 'AuxDataDouble', signature: 'AuxDataDouble(name)', description: 'Returns aux data double value' },
        { name: 'AuxDataBool', signature: 'AuxDataBool(name)', description: 'Returns aux data bool value' },
        { name: 'GetAllAuxDataTypes', signature: 'GetAllAuxDataTypes()', description: 'Returns map of aux data names to types' },
    ],

    // ---- WsfTrack ----
    'wsftrack': [
        { name: 'TrackId', signature: 'TrackId()', description: 'Returns the WsfTrackId' },
        { name: 'StartTime', signature: 'StartTime()', description: 'Returns the track start time' },
        { name: 'UpdateTime', signature: 'UpdateTime()', description: 'Returns the last update time' },
        { name: 'UpdateCount', signature: 'UpdateCount()', description: 'Returns the number of updates' },
        { name: 'IsStale', signature: 'IsStale()', description: 'Returns true if track is stale' },
        { name: 'IsPredefined', signature: 'IsPredefined()', description: 'Returns true if track is predefined' },
        { name: 'IsFalseTarget', signature: 'IsFalseTarget()', description: 'Returns true if track is a false target' },
        { name: 'IsValid', signature: 'IsValid()', description: 'Returns true if track is valid' },
        { name: 'LocationValid', signature: 'LocationValid()', description: 'Returns true if location is valid' },
        { name: 'AltitudeKnown', signature: 'AltitudeKnown()', description: 'Returns true if altitude is known' },
        { name: 'HeadingValid', signature: 'HeadingValid()', description: 'Returns true if heading is valid' },
        { name: 'VelocityValid', signature: 'VelocityValid()', description: 'Returns true if velocity is valid' },
        { name: 'FrequencyValid', signature: 'FrequencyValid()', description: 'Returns true if frequency is valid' },
        { name: 'RangeValid', signature: 'RangeValid()', description: 'Returns true if range is valid' },
        { name: 'BearingValid', signature: 'BearingValid()', description: 'Returns true if bearing is valid' },
        { name: 'ElevationValid', signature: 'ElevationValid()', description: 'Returns true if elevation is valid' },
        { name: 'TypeValid', signature: 'TypeValid()', description: 'Returns true if type is valid' },
        { name: 'SideValid', signature: 'SideValid()', description: 'Returns true if side is valid' },
        { name: 'SignalToNoiseValid', signature: 'SignalToNoiseValid()', description: 'Returns true if S/N ratio is valid' },
        { name: 'ReportedLocation', signature: 'ReportedLocation()', description: 'Returns the reported location' },
        { name: 'CurrentLocation', signature: 'CurrentLocation()', description: 'Returns current location as WsfGeoPoint' },
        { name: 'Latitude', signature: 'Latitude()', description: 'Returns track latitude' },
        { name: 'Longitude', signature: 'Longitude()', description: 'Returns track longitude' },
        { name: 'Altitude', signature: 'Altitude()', description: 'Returns track altitude' },
        { name: 'Range', signature: 'Range()', description: 'Returns range to track' },
        { name: 'Bearing', signature: 'Bearing()', description: 'Returns bearing to track' },
        { name: 'Elevation', signature: 'Elevation()', description: 'Returns elevation to track' },
        { name: 'Type', signature: 'Type()', description: 'Returns track type' },
        { name: 'Side', signature: 'Side()', description: 'Returns track side' },
        { name: 'SignalToNoise', signature: 'SignalToNoise()', description: 'Returns signal-to-noise ratio' },
        { name: 'TrackQuality', signature: 'TrackQuality()', description: 'Returns track quality metric' },
        { name: 'SensorName', signature: 'SensorName()', description: 'Returns the detecting sensor name' },
        { name: 'SensorType', signature: 'SensorType()', description: 'Returns the detecting sensor type' },
        { name: 'TargetName', signature: 'TargetName()', description: 'Returns the target name' },
        { name: 'Target', signature: 'Target()', description: 'Returns the target WsfPlatform' },
        { name: 'AuxDataString', signature: 'AuxDataString(name)', description: 'Returns aux data string value' },
        { name: 'AuxDataInt', signature: 'AuxDataInt(name)', description: 'Returns aux data int value' },
        { name: 'AuxDataDouble', signature: 'AuxDataDouble(name)', description: 'Returns aux data double value' },
        { name: 'AuxDataBool', signature: 'AuxDataBool(name)', description: 'Returns aux data bool value' },
        { name: 'GetAllAuxDataTypes', signature: 'GetAllAuxDataTypes()', description: 'Returns map of aux data names to types' },
    ],

    // ---- WsfArticulatedPart ----
    'wsfarticulatedpart': [
        { name: 'Name', signature: 'Name()', description: 'Returns the part name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the part type' },
        { name: 'IsTurnedOn', signature: 'IsTurnedOn()', description: 'Returns true if part is turned on' },
        { name: 'IsOperational', signature: 'IsOperational()', description: 'Returns true if part is operational' },
        { name: 'CurrentMode', signature: 'CurrentMode()', description: 'Returns the current mode' },
        { name: 'Yaw', signature: 'Yaw()', description: 'Returns the yaw angle' },
        { name: 'Pitch', signature: 'Pitch()', description: 'Returns the pitch angle' },
        { name: 'Roll', signature: 'Roll()', description: 'Returns the roll angle' },
        { name: 'AuxDataString', signature: 'AuxDataString(name)', description: 'Returns aux data string value' },
        { name: 'AuxDataInt', signature: 'AuxDataInt(name)', description: 'Returns aux data int value' },
        { name: 'AuxDataDouble', signature: 'AuxDataDouble(name)', description: 'Returns aux data double value' },
        { name: 'AuxDataBool', signature: 'AuxDataBool(name)', description: 'Returns aux data bool value' },
        { name: 'GetAllAuxDataTypes', signature: 'GetAllAuxDataTypes()', description: 'Returns map of aux data names to types' },
    ],

    // ---- WsfWeaponEngagement ----
    'wsfweaponengagement': [
        { name: 'FiringPlatform', signature: 'FiringPlatform()', description: 'Returns the firing platform' },
        { name: 'WeaponPlatform', signature: 'WeaponPlatform()', description: 'Returns the weapon platform' },
        { name: 'WeaponLocationAtLaunch', signature: 'WeaponLocationAtLaunch()', description: 'Returns the weapon location at launch' },
    ],

    // ---- WsfRIPRJob ----
    'wsfriprjob': [
        { name: 'GetName', signature: 'GetName()', description: 'Returns the job name' },
        { name: 'Priority', signature: 'Priority()', description: 'Returns the job priority' },
        { name: 'BestProgress', signature: 'BestProgress()', description: 'Returns the best progress value' },
        { name: 'WinnersMin', signature: 'WinnersMin()', description: 'Returns the minimum winners' },
        { name: 'WinnersMax', signature: 'WinnersMax()', description: 'Returns the maximum winners' },
        { name: 'Winners', signature: 'Winners()', description: 'Returns the winners' },
        { name: 'Data', signature: 'Data()', description: 'Returns the job data' },
        { name: 'DependenciesForJob', signature: 'DependenciesForJob()', description: 'Returns set of dependency IDs' },
        { name: 'Assigner', signature: 'Assigner()', description: 'Returns the RIPR processor assigner' },
    ],

    // ---- WsfRIPRProcessor ----
    'wsfriprprocessor': [
        { name: 'Name', signature: 'Name()', description: 'Returns the processor name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the processor type' },
        { name: 'Jobs', signature: 'Jobs()', description: 'Returns the array of RIPR jobs' },
        { name: 'IsTurnedOn', signature: 'IsTurnedOn()', description: 'Returns true if turned on' },
        { name: 'IsOperational', signature: 'IsOperational()', description: 'Returns true if operational' },
    ],

    // ---- WsfLocalTrack ----
    'wsflocaltrack': [
        { name: 'RawTrackCount', signature: 'RawTrackCount()', description: 'Returns the number of raw tracks' },
        { name: 'RawTrack', signature: 'RawTrack(index)', description: 'Returns the raw track at the given index' },
    ],

    // ---- WsfLocalTrackList ----
    'wsflocaltracklist': [
        { name: 'TrackCount', signature: 'TrackCount()', description: 'Returns the number of tracks' },
        { name: 'TrackEntry', signature: 'TrackEntry(index)', description: 'Returns the track at the given index' },
    ],

    // ---- WsfComm ----
    'wsfcomm': [
        { name: 'Name', signature: 'Name()', description: 'Returns the comm device name' },
        { name: 'Type', signature: 'Type()', description: 'Returns the comm device type' },
        { name: 'IsTurnedOn', signature: 'IsTurnedOn()', description: 'Returns true if turned on' },
        { name: 'IsOperational', signature: 'IsOperational()', description: 'Returns true if operational' },
    ],

    // ---- WsfCommandChain ----
    'wsfcommandchain': [
        { name: 'Name', signature: 'Name()', description: 'Returns the chain name' },
        { name: 'Commander', signature: 'Commander()', description: 'Returns the commander platform' },
        { name: 'Peers', signature: 'Peers()', description: 'Returns array of peer platforms' },
        { name: 'Subordinates', signature: 'Subordinates(name?)', description: 'Returns array of subordinate platforms' },
        { name: 'SetCommander', signature: 'SetCommander(platform)', description: 'Sets the commander' },
    ],

    // ---- WsfGeoPoint ----
    'wsfgeopoint': [
        { name: 'Latitude', signature: 'Latitude()', description: 'Returns latitude (degrees)' },
        { name: 'Longitude', signature: 'Longitude()', description: 'Returns longitude (degrees)' },
        { name: 'Altitude', signature: 'Altitude()', description: 'Returns altitude (meters)' },
        { name: 'ToString', signature: 'ToString()', description: 'Returns string representation' },
        { name: 'Extrapolate', signature: 'Extrapolate(heading, distance)', description: 'Moves point along heading by distance' },
        { name: 'IsValid', signature: 'IsValid()', description: 'Returns true if point is valid' },
    ],

    // ---- WsfFuel ----
    'wsffuel': [
        { name: 'IsValid', signature: 'IsValid()', description: 'Returns true if fuel system is valid' },
        { name: 'ConsumptionRate', signature: 'ConsumptionRate()', description: 'Returns current fuel consumption rate' },
        { name: 'Quantity', signature: 'Quantity()', description: 'Returns current fuel quantity' },
        { name: 'Mode', signature: 'Mode()', description: 'Returns current fuel mode' },
    ],

    // ---- WsfDraw ----
    'wsfdraw': [
        { name: 'SetLayer', signature: 'SetLayer(name)', description: 'Sets the drawing layer' },
        { name: 'SetDuration', signature: 'SetDuration(seconds)', description: 'Sets how long drawing persists' },
        { name: 'SetColor', signature: 'SetColor(r, g, b)', description: 'Sets RGB color (0-1)' },
        { name: 'SetLineSize', signature: 'SetLineSize(size)', description: 'Sets line width' },
        { name: 'SetPointSize', signature: 'SetPointSize(size)', description: 'Sets point size' },
        { name: 'SetLineStyle', signature: 'SetLineStyle(style)', description: 'Sets line style (e.g. "solid")' },
        { name: 'BeginPolyline', signature: 'BeginPolyline()', description: 'Starts a polyline' },
        { name: 'BeginEllipse', signature: 'BeginEllipse(minRange, maxRange, azimuthExtent)', description: 'Starts an ellipse' },
        { name: 'BeginLines', signature: 'BeginLines()', description: 'Starts line segments' },
        { name: 'BeginPoints', signature: 'BeginPoints()', description: 'Starts point drawing' },
        { name: 'Vertex', signature: 'Vertex(location)', description: 'Adds a vertex (WsfGeoPoint or WsfPlatform)' },
        { name: 'VertexLLA', signature: 'VertexLLA(lat, lon, alt)', description: 'Adds a vertex via LLA coordinates' },
        { name: 'End', signature: 'End()', description: 'Ends the current drawing primitive' },
    ],

    // ---- WsfRouteFinder ----
    'wsfroutefinder': [
        { name: 'Route', signature: 'Route(time, src, dst, speed)', description: 'Finds a route from src to dst' },
        { name: 'SetMaxArcLength', signature: 'SetMaxArcLength(length)', description: 'Sets max arc length' },
        { name: 'ClearAvoidances', signature: 'ClearAvoidances()', description: 'Clears all avoidance zones' },
        { name: 'Avoid', signature: 'Avoid(location, radius)', description: 'Adds an avoidance zone' },
        { name: 'DrawAvoidances', signature: 'DrawAvoidances(layer, color)', description: 'Draws avoidance zones' },
    ],

    // ---- WsfTrackMessage ----
    'wsftrackmessage': [
        { name: 'Track', signature: 'Track()', description: 'Returns the WsfTrack from this message' },
        { name: 'MessageType', signature: 'MessageType()', description: 'Returns the message type string' },
    ],

    // ---- WsfTrackId ----
    'wsftrackid': [
        { name: 'OwningPlatform', signature: 'OwningPlatform()', description: 'Returns the platform that owns this track' },
        { name: 'TrackNumber', signature: 'TrackNumber()', description: 'Returns the track number' },
        { name: 'SensorName', signature: 'SensorName()', description: 'Returns the sensor name' },
    ],

    // ---- ArrayIterator ----
    'arrayiterator': [
        { name: 'HasNext', signature: 'HasNext()', description: 'Returns true if more elements exist' },
        { name: 'Next', signature: 'Next()', description: 'Returns the next element' },
        { name: 'Key', signature: 'Key()', description: 'Returns the current element key/index' },
    ],
};

// =============================================================================
// Unit completions
// =============================================================================

const unitCompletions: vscode.CompletionItem[] = [
    // ---- Time ----
    ci('sec', 'Seconds', vscode.CompletionItemKind.Unit),
    ci('seconds', 'Seconds (word form)', vscode.CompletionItemKind.Unit),
    ci('min', 'Minutes', vscode.CompletionItemKind.Unit),
    ci('minutes', 'Minutes (word form)', vscode.CompletionItemKind.Unit),
    ci('hr', 'Hours', vscode.CompletionItemKind.Unit),
    ci('hours', 'Hours (word form)', vscode.CompletionItemKind.Unit),
    ci('day', 'Days', vscode.CompletionItemKind.Unit),
    ci('days', 'Days (word form)', vscode.CompletionItemKind.Unit),

    // ---- Distance / Altitude ----
    ci('ft', 'Feet', vscode.CompletionItemKind.Unit),
    ci('feet', 'Feet (word form)', vscode.CompletionItemKind.Unit),
    ci('kft', 'Kilofeet (1000 ft)', vscode.CompletionItemKind.Unit),
    ci('m', 'Meters', vscode.CompletionItemKind.Unit),
    ci('meters', 'Meters (word form)', vscode.CompletionItemKind.Unit),
    ci('km', 'Kilometers', vscode.CompletionItemKind.Unit),
    ci('nm', 'Nautical miles', vscode.CompletionItemKind.Unit),
    ci('nmi', 'Nautical miles (alternate)', vscode.CompletionItemKind.Unit),
    ci('miles', 'Statute miles', vscode.CompletionItemKind.Unit),

    // ---- Altitude qualifiers ----
    ci('ft msl', 'Feet above mean sea level', vscode.CompletionItemKind.Unit),
    ci('ft agl', 'Feet above ground level', vscode.CompletionItemKind.Unit),
    ci('m msl', 'Meters above mean sea level', vscode.CompletionItemKind.Unit),
    ci('m agl', 'Meters above ground level', vscode.CompletionItemKind.Unit),

    // ---- Speed ----
    ci('kts', 'Knots', vscode.CompletionItemKind.Unit),
    ci('knots', 'Knots (word form)', vscode.CompletionItemKind.Unit),
    ci('mph', 'Miles per hour', vscode.CompletionItemKind.Unit),
    ci('m/s', 'Meters per second', vscode.CompletionItemKind.Unit),
    ci('ft/s', 'Feet per second', vscode.CompletionItemKind.Unit),
    ci('ft/min', 'Feet per minute', vscode.CompletionItemKind.Unit),
    ci('fpm', 'Feet per minute (abbrev.)', vscode.CompletionItemKind.Unit),

    // ---- Angle ----
    ci('deg', 'Degrees', vscode.CompletionItemKind.Unit),
    ci('degrees', 'Degrees (word form)', vscode.CompletionItemKind.Unit),
    ci('rad', 'Radians', vscode.CompletionItemKind.Unit),
    ci('deg/s', 'Degrees per second', vscode.CompletionItemKind.Unit),
    ci('rad/s', 'Radians per second', vscode.CompletionItemKind.Unit),
    ci('deg/s^2', 'Degrees per second squared', vscode.CompletionItemKind.Unit),
    ci('rad/s^2', 'Radians per second squared', vscode.CompletionItemKind.Unit),
    ci('rpm', 'Revolutions per minute', vscode.CompletionItemKind.Unit),

    // ---- Weight / Mass ----
    ci('kg', 'Kilograms', vscode.CompletionItemKind.Unit),
    ci('lbs', 'Pounds', vscode.CompletionItemKind.Unit),
    ci('lb', 'Pounds (singular)', vscode.CompletionItemKind.Unit),

    // ---- Mass flow ----
    ci('kg/s', 'Kilograms per second', vscode.CompletionItemKind.Unit),
    ci('lb/s', 'Pounds per second', vscode.CompletionItemKind.Unit),
    ci('lbs/sec', 'Pounds per second', vscode.CompletionItemKind.Unit),
    ci('lb/hr', 'Pounds per hour', vscode.CompletionItemKind.Unit),
    ci('kg/sec', 'Kilograms per second', vscode.CompletionItemKind.Unit),

    // ---- Frequency / Signal ----
    ci('Hz', 'Hertz', vscode.CompletionItemKind.Unit),
    ci('kHz', 'Kilohertz', vscode.CompletionItemKind.Unit),
    ci('MHz', 'Megahertz', vscode.CompletionItemKind.Unit),
    ci('GHz', 'Gigahertz', vscode.CompletionItemKind.Unit),
    ci('dB', 'Decibels', vscode.CompletionItemKind.Unit),
    ci('dBm', 'Decibel-milliwatts', vscode.CompletionItemKind.Unit),

    // ---- Other ----
    ci('m^2', 'Square meters (RCS)', vscode.CompletionItemKind.Unit),
    ci('kN', 'Kilonewtons (thrust)', vscode.CompletionItemKind.Unit),
    ci('lbf', 'Pounds-force', vscode.CompletionItemKind.Unit),
    ci('lbm', 'Pounds-mass', vscode.CompletionItemKind.Unit),
];

// =============================================================================
// Completion provider
// =============================================================================

class WsfCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const items: vscode.CompletionItem[] = [];

        // Check if we're after '.' for member access
        const dotMatch = linePrefix.match(/\.\s*(\w*)$/);
        if (dotMatch) {
            // Determine the qualifying prefix before the dot
            const beforeDot = linePrefix.substring(0, dotMatch.index);
            const staticMatch = beforeDot.match(/(\w+)$/);
            const className = staticMatch ? staticMatch[1] : '';

            // Check for known static class prefixes
            switch (className) {
                case 'MATH':
                    for (const m of mathMethods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                case 'Vec3':
                    for (const m of vec3Methods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                case 'Format':
                    for (const m of formatMethods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                case 'WsfSimulation':
                    for (const m of simMethods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                case 'FileIO':
                    for (const m of fileIOMethods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                case 'struct':
                    for (const m of structMethods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                case 'WsfGeoPoint':
                    const gpMethods: MethodInfo[] = [{ name: 'Construct', signature: 'Construct("lat lon")', description: 'Creates a WsfGeoPoint from a string' }];
                    for (const m of gpMethods) { items.push(methodCI(m, vscode.CompletionItemKind.Method)); }
                    return items;
                default:
                    // Show all instance methods for .method() access
                    const allMethods = new Set<string>();
                    for (const methods of Object.values(typeMethods)) {
                        for (const m of methods) {
                            if (!allMethods.has(m.name)) {
                                allMethods.add(m.name);
                                items.push(methodCI(m, vscode.CompletionItemKind.Method));
                            }
                        }
                    }
                    return items;
            }
        }

        // Check if we're after a number for unit completion
        if (/\d\s+$/.test(linePrefix)) {
            items.push(...unitCompletions);
            return items;
        }

        // General context: keywords, builtins, types, globals
        items.push(...keywords);
        items.push(...builtInVars);
        items.push(...types);
        for (const m of globalFunctions) {
            items.push(methodCI(m, vscode.CompletionItemKind.Function));
        }

        return items;
    }
}

// =============================================================================
// Hover provider
// =============================================================================

class WsfHoverProvider implements vscode.HoverProvider {
    private hoverMap: Map<string, string> = new Map();

    constructor() {
        // Keyword hovers
        const kwHovers: [string, string][] = [
            ['if', '**if** (condition) *statement* — Conditional execution'],
            ['else', '**else** *statement* — Alternative execution when if condition fails'],
            ['else if', '**else if** (condition) *statement* — Chained conditional'],
            ['for', '**for** (init; condition; increment) *statement* — Counter-based loop'],
            ['foreach', '**foreach** (type var in container) *statement* — Iterate over container elements'],
            ['while', '**while** (condition) *statement* — Pre-checked loop'],
            ['do', '**do** *statement* **while** (condition); — Post-checked loop'],
            ['break', '**break** — Exit the innermost loop immediately'],
            ['continue', '**continue** — Skip to the next iteration of the loop'],
            ['return', '**return** [expression] — Return from function with optional value'],
            ['global', '**global** — Declare a global variable (shared across platform)'],
            ['static', '**static** — Declare a static variable (persists across calls)'],
            ['extern', '**extern** — Declare an external function or variable'],
            ['in', '**in** — Used in foreach loops for container iteration'],
            ['when', '**when** — Condition clause for state/phase transitions'],
            ['on', '**on** — Turn on a component or toggle state'],
            ['off', '**off** — Turn off a component'],
            ['enable', '**enable** — Enable a feature (e.g., event output)'],
            ['disable', '**disable** — Disable a feature'],
            ['script', '**script** *type name(params)* ... **end_script** — Define a script function block'],
        ];
        for (const [word, desc] of kwHovers) {
            this.hoverMap.set(word, desc);
        }

        // Type hovers
        const typeHovers: [string, string][] = [
            ['void', '`void` — No return value'],
            ['string', '`string` — Character string'],
            ['int', '`int` — 32-bit signed integer'],
            ['double', '`double` — Double-precision floating point'],
            ['char', '`char` — Single character'],
            ['bool', '`bool` — Boolean (true/false)'],
            ['var', '`var` — Variant (can hold any type)'],
            ['Object', '`Object` — Base type for all objects'],
            ['struct', '`struct` — Dynamic struct type, use `struct.New("TypeName")` to create'],
            ['Array', '`Array<T>` — Dynamic array container with `Size()`, `Empty()`, `Back()`, `PopBack()`, `PushBack()`, `GetIterator()`'],
            ['Map', '`Map<K,V>` — Key-value map container with `Size()`, `Empty()`, `ElementKeyAtIndex()`'],
            ['Set', '`Set<T>` — Unique element set container with `Size()`, `Empty()`'],
            ['WsfPlatform', '`WsfPlatform` — Platform (aircraft, ship, etc.) — Use `Name()`, `Side()`, `Location()`, `Fuel()`, etc.'],
            ['WsfProcessor', '`WsfProcessor` — Processor on a platform — Use `IsTurnedOn()`, `TurnOn()`'],
            ['WsfSensor', '`WsfSensor` — Sensor on a platform — Use `CurrentMode()`, `TurnOn()`'],
            ['WsfWeapon', '`WsfWeapon` — Weapon on a platform — Use `Fire()`, `QuantityRemaining()`'],
            ['WsfRoute', '`WsfRoute` — Route with waypoints — Use `Size()`, `Waypoint(index)`'],
            ['WsfWaypoint', '`WsfWaypoint` — Waypoint in a route — Use `Location()`, `Speed()`, `Heading()`'],
            ['WsfTrack', '`WsfTrack` — Track (detected object) — Use `TrackId()`, `ReportedLocation()`, `IsStale()`'],
            ['WsfPlatformPart', '`WsfPlatformPart` — Base for platform parts — Use `Name()`, `IsTurnedOn()`, `IsOperational()`'],
            ['WsfArticulatedPart', '`WsfArticulatedPart` — Articulated part — Use `Yaw()`, `Pitch()`, `Roll()`'],
            ['WsfWeaponEngagement', '`WsfWeaponEngagement` — Weapon engagement — Use `FiringPlatform()`, `WeaponPlatform()`'],
            ['WsfRIPRJob', '`WsfRIPRJob` — RIPR scheduling job — Use `GetName()`, `Priority()`, `DependenciesForJob()`'],
            ['WsfRIPRProcessor', '`WsfRIPRProcessor` — RIPR scheduling processor — Use `Jobs()`'],
            ['WsfLocalTrack', '`WsfLocalTrack` — Local track with raw data — Use `RawTrackCount()`, `RawTrack()`'],
            ['WsfSimulation', '`WsfSimulation` — Global simulation (static) — Use `PlatformCount()`, `FindPlatform()`'],
            ['WsfComm', '`WsfComm` — Communication device on a platform — Use `Name()`, `IsTurnedOn()`'],
            ['WsfCommandChain', '`WsfCommandChain` — Command chain/hierarchy — Use `Commander()`, `Subordinates()`'],
            ['WsfGeoPoint', '`WsfGeoPoint` — Geographic point (lat/lon/alt) — Use `Latitude()`, `Longitude()`, `Altitude()`'],
            ['WsfFuel', '`WsfFuel` — Fuel system — Use `Quantity()`, `ConsumptionRate()`'],
            ['WsfDraw', '`WsfDraw` — Drawing utilities — Use `BeginLines()`, `Vertex()`, `End()`'],
            ['WsfRouteFinder', '`WsfRouteFinder` — Route planning — Use `Route()`, `Avoid()`'],
            ['WsfTrackMessage', '`WsfTrackMessage` — Track message from on_message — Cast from MESSAGE: `(WsfTrackMessage)MESSAGE`'],
            ['WsfVideoMessage', '`WsfVideoMessage` — Video message type in on_message'],
            ['WsfSensorInteraction', '`WsfSensorInteraction` — Sensor interaction result in detection callbacks'],
            ['WsfLocalTrackList', '`WsfLocalTrackList` — Local track list — Use `TrackCount()`, `TrackEntry()`'],
            ['WsfTrackId', '`WsfTrackId` — Track identifier — Use `OwningPlatform()`, `TrackNumber()`'],
            ['FileIO', '`FileIO` — File I/O utility — Use `Open()`, `WriteLine()`, `Close()`'],
            ['Vec3', '`Vec3` — 3D vector (static) — Use `Vec3.Construct()`, `Vec3.Dot()`, `Vec3.Cross()`'],
            ['MATH', '`MATH` — Math utilities (static) — Use `MATH.M_PER_FT()`, `MATH.RandomUniform()`'],
            ['Format', '`Format` — Formatting utilities (static) — Use `Format.Fixed()`, `Format.Scientific()`'],
            ['ArrayIterator', '`ArrayIterator` — Array iterator — Use `HasNext()`, `Next()`'],
        ];
        for (const [word, desc] of typeHovers) {
            this.hoverMap.set(word, desc);
        }

        // Built-in variable hovers
        const varHovers: [string, string][] = [
            ['PLATFORM', '`PLATFORM` (*WsfPlatform*) — The platform this script is running on'],
            ['PROCESSOR', '`PROCESSOR` (*WsfProcessor*) — The processor this script is running in'],
            ['TRACK', '`TRACK` (*WsfTrack*) — The current track (available in task/state processors)'],
            ['TIME_NOW', '`TIME_NOW` (*double*) — Current simulation time in seconds'],
            ['MESSAGE', '`MESSAGE` (*variant*) — Message object in `on_message` blocks. Cast to specific type: `(WsfTrackMessage)MESSAGE`'],
            ['SELF', '`SELF` (*role*) — Self role identifier in command chains'],
        ];
        for (const [word, desc] of varHovers) {
            this.hoverMap.set(word, desc);
        }

        // Method hovers from typeMethods
        for (const methods of Object.values(typeMethods)) {
            for (const m of methods) {
                this.hoverMap.set(m.name, `\`${m.signature}\` — ${m.description}`);
            }
        }

        // Global function hovers
        for (const m of globalFunctions) {
            this.hoverMap.set(m.name, `\`${m.signature}\` — ${m.description}`);
        }

        // Static method hovers
        for (const m of mathMethods) {
            this.hoverMap.set(m.name, `\`MATH.${m.signature}\` — ${m.description}`);
        }
        for (const m of vec3Methods) {
            this.hoverMap.set(m.name, `\`Vec3.${m.signature}\` — ${m.description}`);
        }
        for (const m of formatMethods) {
            this.hoverMap.set(m.name, `\`Format.${m.signature}\` — ${m.description}`);
        }
        for (const m of simMethods) {
            this.hoverMap.set(m.name, `\`WsfSimulation.${m.signature}\` — ${m.description}`);
        }
        for (const m of structMethods) {
            this.hoverMap.set(m.name, `\`struct.${m.signature}\` — ${m.description}`);
        }
        for (const m of fileIOMethods) {
            this.hoverMap.set(m.name, `\`FileIO.${m.signature}\` — ${m.description}`);
        }

        // WSF block command hovers
        const blockHovers: [string, string][] = [
            ['platform_type', '`platform_type` *name* *TYPE* ... `end_platform_type` — Define a platform type'],
            ['platform', '`platform` *name* *type* ... `end_platform` — Define a platform instance'],
            ['processor', '`processor` *name* *PROC_TYPE* ... `end_processor` — Define a processor'],
            ['sensor', '`sensor` *name* *SENSOR_TYPE* ... `end_sensor` — Define a sensor'],
            ['comm', '`comm` *name* *COMM_TYPE* ... `end_comm` — Define a communication device'],
            ['weapon', '`weapon` *name* *WEAPON_TYPE* ... `end_weapon` — Define a weapon'],
            ['mover', '`mover` *MOVER_TYPE* ... `end_mover` — Define a mover (can be inline)'],
            ['route', '`route` *name* ... `end_route` — Define a route with waypoints'],
            ['waypoint', '`waypoint` ... `end_waypoint` — Define a waypoint in a route'],
            ['zone', '`zone` *name* ... `end_zone` — Define a geographic zone'],
            ['track', '`track` ... `end_track` — Define a track definition'],
            ['simulation', '`simulation` ... `end_simulation` — Simulation-level configuration'],
            ['network', '`network` *name* *NET_TYPE* ... `end_network` — Define a communication network'],
            ['callback', '`callback` *name* *CB_TYPE* ... `end_callback` — Define a callback trigger'],
            ['event_pipe', '`event_pipe` *config* ... `end_event_pipe` — Event pipe configuration (can be inline)'],
            ['event_output', '`event_output` *config* ... `end_event_output` — Event output configuration (can be inline)'],
            ['script_interface', '`script_interface` ... `end_script_interface` — Script interface definition'],
            ['dis_interface', '`dis_interface` ... `end_dis_interface` — DIS interface configuration'],
            ['aux_data', '`aux_data` ... `end_aux_data` — Auxiliary data block'],
            ['edit', '`edit` *instance* *attribute* *value* ... `end_edit` — Edit instance attributes'],
            ['script_variables', '`script_variables` ... `end_script_variables` — Declare script-level variables'],
            ['on_initialize', '`on_initialize` ... `end_on_initialize` — Called once when processor initializes'],
            ['on_update', '`on_update` ... `end_on_update` — Called on each processor update cycle'],
            ['on_message', '`on_message` ... `end_on_message` — Handle incoming messages by type'],
            ['on_entry', '`on_entry` ... `end_on_entry` — Called when entering a state or phase'],
            ['state', '`state` *name* ... `end_state` — State machine state definition'],
            ['next_state', '`next_state` *name* `when` *condition* ... `end_next_state` — State transition rule'],
            ['phase', '`phase` *name* ... `end_phase` — Guidance phase definition'],
            ['next_phase', '`next_phase` *name* `when` *condition* — Next phase transition'],
            ['execute', '`execute` *schedule* ... `end_execute` — Scheduled script execution block'],
            ['conditional_section', '`conditional_section` ... `end_conditional_section` — Conditionally included section'],
            ['include_once', '`include_once` *file* — Include a file once (prevents duplicate includes)'],
            ['include', '`include` *file* — Include another WSF file'],
            ['evaluation_interval', '`evaluation_interval` *stateName* *time* — Set evaluation interval for a state'],
            ['$define', '`$define` *VAR* *VALUE* — Preprocessor variable definition'],
        ];
        for (const [word, desc] of blockHovers) {
            this.hoverMap.set(word, desc);
        }
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position, /\b\w+\b/);
        if (!range) { return null; }

        const word = document.getText(range);
        const desc = this.hoverMap.get(word);
        if (desc) {
            return new vscode.Hover(new vscode.MarkdownString(desc), range);
        }
        return null;
    }
}

// =============================================================================
// Include link provider (Ctrl+click on include/include_once paths)
// =============================================================================

class WsfIncludeLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentLink[]> {
        const links: vscode.DocumentLink[] = [];

        // First pass: collect variable definitions and file_path
        const vars = new Map<string, string>();
        let filePathBase = '';
        for (let i = 0; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            if (/^\s*#/.test(text)) { continue; }

            // file_path <dir>
            let m = text.match(/^\s*file_path\s+(\S+)/);
            if (m) {
                filePathBase = m[1];
                continue;
            }

            // define_path_variable NAME  VALUE
            m = text.match(/^\s*define_path_variable\s+(\w+)\s+(.+?)(?:\s*\/\/.*)?$/);
            if (m) {
                vars.set(m[1], m[2].trim());
                continue;
            }

            // $define NAME VALUE
            m = text.match(/^\s*\$define\s+(\w+)\s+(.+?)(?:\s*\/\/.*)?$/);
            if (m) {
                vars.set(m[1], m[2].trim());
            }
        }

        // Determine base directory for relative includes
        const docDir = vscode.Uri.joinPath(document.uri, '..').fsPath;
        const parentDir = vscode.Uri.joinPath(document.uri, '..', '..').fsPath;
        const baseDir = filePathBase === '.'
            ? docDir
            : filePathBase
                ? path.resolve(docDir, filePathBase)
                : docDir;

        // Build candidate base directories to try (ordered by priority)
        const candidateDirs = [baseDir];
        if (baseDir !== parentDir) { candidateDirs.push(parentDir); }

        // Resolve a path by substituting known variables
        const resolvePath = (raw: string): string => {
            return raw.replace(/\$\{(\w+)\}/g, (_, name) => vars.get(name) ?? `\${${name}}`);
        };

        // Resolve include path to actual file on disk, trying candidate dirs
        const resolveToExisting = (cleanPath: string): string | null => {
            if (cleanPath.startsWith('/') || cleanPath.match(/^[A-Za-z]:/)) {
                const p = cleanPath.replace(/\//g, '\\');
                return fs.existsSync(p) ? p : null;
            }
            const normalized = cleanPath.replace(/\//g, '\\');
            for (const dir of candidateDirs) {
                const p = dir + '\\' + normalized;
                if (fs.existsSync(p)) { return p; }
            }
            // Fall back to primary base dir even if file doesn't exist
            return candidateDirs[0] + '\\' + normalized;
        };

        // Second pass: find include/include_once and create links
        const includeRegex = /\b(include_once|include)\s+(\S+)/g;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;

            if (/^\s*(#|\/\/)/.test(text)) { continue; }

            let match: RegExpExecArray | null;
            includeRegex.lastIndex = 0;
            while ((match = includeRegex.exec(text)) !== null) {
                const filePath = match[2];
                const startChar = match.index + match[1].length + 1;
                const endChar = startChar + filePath.length;
                const range = new vscode.Range(i, startChar, i, endChar);

                // Resolve variables in the path
                const resolved = resolvePath(filePath);
                // Strip remaining unresolved variables and other preprocessor forms
                const cleanPath = resolved
                    .replace(/\$<[^>]*>\$?/g, '')
                    .replace(/\$\{[^}]*\}/g, '')
                    .replace(/\$\([^)]*\)/g, '');
                if (!cleanPath || cleanPath === '/') { continue; }

                const targetPath = resolveToExisting(cleanPath);
                if (!targetPath) { continue; }

                const link = new vscode.DocumentLink(range, vscode.Uri.file(targetPath));
                const tooltipParts = [filePath];
                if (resolved !== filePath) { tooltipParts.push(`→ ${resolved}`); }
                link.tooltip = tooltipParts.join(' ');
                links.push(link);
            }
        }

        return links;
    }

    // Shared helper: resolve include files for a document (returns absolute paths)
    resolveIncludes(document: vscode.TextDocument): string[] {
        return resolveIncludeFiles(document.uri.fsPath, document.getText());
    }
}

// =============================================================================
// Shared: resolve include file paths from a WSF file's content
// =============================================================================

function resolveIncludeFiles(filePath: string, content: string): string[] {
    const files: string[] = [filePath];
    const vars = new Map<string, string>();
    let filePathBase = '';
    const lines = content.split(/\r?\n/);

    for (const text of lines) {
        if (/^\s*#/.test(text)) { continue; }
        let m = text.match(/^\s*file_path\s+(\S+)/);
        if (m) { filePathBase = m[1]; continue; }
        m = text.match(/^\s*define_path_variable\s+(\w+)\s+(.+?)(?:\s*\/\/.*)?$/);
        if (m) { vars.set(m[1], m[2].trim()); continue; }
        m = text.match(/^\s*\$define\s+(\w+)\s+(.+?)(?:\s*\/\/.*)?$/);
        if (m) { vars.set(m[1], m[2].trim()); }
    }

    const docDir = path.dirname(filePath);
    const parentDir = path.dirname(docDir);
    const baseDir = filePathBase === '.' ? docDir
        : filePathBase ? path.resolve(docDir, filePathBase) : docDir;
    const candidateDirs = [baseDir];
    if (baseDir !== parentDir) { candidateDirs.push(parentDir); }

    const resolveVars = (raw: string) =>
        raw.replace(/\$\{(\w+)\}/g, (_, name) => vars.get(name) ?? `\${${name}}`);

    const includeRegex = /\b(include_once|include)\s+(\S+)/g;
    for (const text of lines) {
        if (/^\s*(#|\/\/)/.test(text)) { continue; }
        let match: RegExpExecArray | null;
        includeRegex.lastIndex = 0;
        while ((match = includeRegex.exec(text)) !== null) {
            const resolved = resolveVars(match[2]);
            const cleanPath = resolved
                .replace(/\$<[^>]*>\$?/g, '')
                .replace(/\$\{[^}]*\}/g, '')
                .replace(/\$\([^)]*\)/g, '');
            if (!cleanPath || cleanPath === '/') { continue; }

            const normalized = cleanPath.replace(/\//g, '\\');
            for (const dir of candidateDirs) {
                const p = dir + '\\' + normalized;
                if (fs.existsSync(p)) { files.push(p); break; }
            }
        }
    }
    return files;
}

// =============================================================================
// Definition provider (F12 / Ctrl+click to jump to type definitions)
// =============================================================================

class WsfDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const wordRange = document.getWordRangeAtPosition(position, /\b\w+\b/);
        if (!wordRange) { return null; }

        const word = document.getText(wordRange);
        const line = document.lineAt(position).text;

        // Determine what kind of type reference this is based on line context
        const context = this.getContext(line, word);
        if (!context) { return null; }

        // Build search set: current file + included files (1 level transitive)
        const includedFiles = resolveIncludeFiles(document.uri.fsPath, document.getText());
        const searched = new Set<string>();
        const locations: vscode.Location[] = [];

        for (const filePath of includedFiles) {
            if (searched.has(filePath)) { continue; }
            searched.add(filePath);
            if (!fs.existsSync(filePath)) { continue; }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
                const l = lines[i];
                if (/^\s*#/.test(l)) { continue; }

                for (const pattern of context.patterns) {
                    const regex = new RegExp(pattern, 'i');
                    const m = l.match(regex);
                    if (m) {
                        const defName = m[1];
                        if (defName.toUpperCase() === word.toUpperCase()) {
                            const start = new vscode.Position(i, l.indexOf(defName));
                            const end = new vscode.Position(i, l.indexOf(defName) + defName.length);
                            locations.push(new vscode.Location(
                                vscode.Uri.file(filePath),
                                new vscode.Range(start, end)
                            ));
                        }
                    }
                }
            }

            // Also collect transitive includes from this file (1 level deep)
            try {
                const subFiles = resolveIncludeFiles(filePath, content);
                for (const sf of subFiles) {
                    if (!searched.has(sf)) {
                        includedFiles.push(sf);
                    }
                }
            } catch (_) { /* ignore */ }
        }

        return locations;
    }

    private getContext(line: string, word: string): { patterns: string[] } | null {
        const kw = '(?:platform_type|platform|sensor|weapon|processor|comm|mover|weapon_effects|antenna_pattern|optical_signature|radar_signature|aero|fuel|fuel_table|network)';

        // Is the word used as a type reference?
        // e.g., "platform NAME TYPE" → TYPE is a platform_type reference
        const refPatterns: [RegExp, string[]][] = [
            // platform_type NAME PARENT → NAME is defined here, PARENT is a parent type
            [/^\s*platform_type\s+\w+\s+(\w+)/, ['^\\s*platform_type\\s+(\\w+)']],
            // platform NAME TYPE → TYPE references a platform_type
            [/^\s*platform\s+\w+\s+(\w+)/, ['^\\s*platform_type\\s+(\\w+)']],
            // sensor NAME TYPE → TYPE references a sensor definition
            [/^\s*sensor\s+\w+\s+(\w+)/, []],
            // weapon NAME TYPE → TYPE references a weapon definition
            [/^\s*weapon\s+\w+\s+(\w+)/, []],
            // processor NAME TYPE → TYPE references a processor definition
            [/^\s*processor\s+\w+\s+(\w+)/, []],
            // comm NAME TYPE → TYPE references a comm definition
            [/^\s*comm\s+\w+\s+(\w+)/, []],
            // mover TYPE → TYPE references a mover definition
            [/^\s*mover\s+(\w+)/, []],
            // route NAME → NAME is defined here
            [/^\s*route\s+(\w+)/, ['^\\s*route\\s+(\\w+)']],
            // waypoint NAME → NAME references a waypoint
            [/^\s*waypoint\s+(\w+)/, []],
            // zone NAME → NAME is defined here
            [/^\s*zone\s+(\w+)/, ['^\\s*zone\\s+(\\w+)']],
            // Generic: any WSF block with a type reference in 3rd position
            [/^\s*(?:weapon_effects|antenna_pattern|optical_signature|radar_signature|aero|fuel|fuel_table|network|script_interface|dis_interface)\s+(\w+)/, []],
        ];

        for (const [regex, patterns] of refPatterns) {
            const m = line.match(regex);
            if (m) {
                const captured = m[1];
                // Check if the word under cursor matches the captured type name
                if (captured === word || new RegExp(`\\b${word}\\b`).test(captured)) {
                    if (patterns.length > 0) {
                        return { patterns };
                    }
                }
                // Also match if the word is the first captured name in a definition pattern
                // e.g. "platform_type BLUE_FIGHTER" → word is BLUE_FIGHTER
                //      we need to find where BLUE_FIGHTER is DEFINED or where it's USED
                // Actually, let me match simpler: if word appears as the 2nd or 3rd identifier
            }
        }

        // Generic type reference: if the word appears on a line starting with a block keyword
        // and is in the 2nd or 3rd position, treat it as a type reference
        const words = line.trim().split(/\s+/);
        const blockKeywords = ['platform_type', 'platform', 'sensor', 'weapon', 'processor', 'comm', 'mover',
            'weapon_effects', 'antenna_pattern', 'optical_signature', 'radar_signature', 'aero', 'fuel',
            'fuel_table', 'network', 'script_interface', 'dis_interface', 'route', 'waypoint', 'zone'];

        if (blockKeywords.includes(words[0]) && words.length >= 2) {
            const idx = words.indexOf(word);
            if (idx >= 1) {
                // Build search patterns: look for definitions where this word is the first identifier
                const searchPatterns = [
                    `^\\s*platform_type\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*sensor\\s+\\w+\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*weapon\\s+\\w+\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*processor\\s+\\w+\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*comm\\s+\\w+\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*mover\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*route\\s+(${this.escapeRegex(word)})\\b`,
                    `^\\s*zone\\s+(${this.escapeRegex(word)})\\b`,
                ];
                return { patterns: searchPatterns };
            }
        }

        return null;
    }

    private escapeRegex(s: string): string {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
