import {
  ToolDispatcher,
  AuthenticationRequiredError,
  TOOL_DEFINITIONS,
  validateToolArguments,
  AgentOrchestrator,
} from '../dist/index.js';

async function runTests() {
  console.log('--- 1. Testing Tool Definitions ---');
  console.log('Tool count:', TOOL_DEFINITIONS.length);
  if (TOOL_DEFINITIONS.length !== 4) {
    throw new Error(`Expected 4 tools, got ${TOOL_DEFINITIONS.length}`);
  }

  for (const tool of TOOL_DEFINITIONS) {
    console.log(`Tool: ${tool.name} | additionalProperties: ${tool.inputSchema.additionalProperties}`);
    if (tool.inputSchema.additionalProperties !== false) {
      throw new Error(`Tool ${tool.name} must have additionalProperties: false`);
    }
    if (tool.name === 'get_course_schedule') {
      if ('studentId' in tool.inputSchema.properties) {
        throw new Error('FAIL: studentId found in get_course_schedule properties!');
      }
    }
  }

  console.log('\n--- 2. Testing Schema Rejection of studentId in get_course_schedule ---');
  const studentIdRejection = validateToolArguments('get_course_schedule', {
    day: 'MONDAY',
    studentId: '241101013',
  });
  console.log('Rejection with studentId:', studentIdRejection.success === false, '| message:', studentIdRejection.errorMessage);
  if (studentIdRejection.success) {
    throw new Error('FAIL: studentId was not rejected!');
  }

  console.log('\n--- 3. Testing ToolDispatcher - Invalid Params (-32602) ---');
  const dispatcher = new ToolDispatcher();
  const guestAuth = { role: 'GUEST' };
  const invalidParamsResult = await dispatcher.dispatch('get_cafeteria_menu', { invalidField: 'bad' }, guestAuth);
  console.log('Invalid params code:', invalidParamsResult.code, '| isError:', invalidParamsResult.isError);
  if (invalidParamsResult.code !== -32602) {
    throw new Error(`FAIL: code is not -32602, got ${invalidParamsResult.code}`);
  }

  console.log('\n--- 4. Testing ToolDispatcher - Unauthenticated get_course_schedule ---');
  try {
    await dispatcher.dispatch('get_course_schedule', { day: 'TODAY' }, guestAuth);
    throw new Error('FAIL: get_course_schedule did not throw without studentId!');
  } catch (err) {
    console.log('Caught expected error:', err.name, '|', err.message);
    if (!err.message.includes('Authentication required')) {
      throw new Error('FAIL: error does not include "Authentication required"');
    }
    if (!(err instanceof AuthenticationRequiredError)) {
      throw new Error('FAIL: err is not instance of AuthenticationRequiredError');
    }
  }

  console.log('\n--- 5. Testing ToolDispatcher - NOT_IMPLEMENTED for unregistered handler ---');
  const studentAuth = { role: 'STUDENT', studentId: '241101013' };
  const notImplementedResult = await dispatcher.dispatch('get_course_schedule', { day: 'TODAY' }, studentAuth);
  console.log('Unregistered tool code:', notImplementedResult.code, '| message:', notImplementedResult.message);
  if (notImplementedResult.code !== 'NOT_IMPLEMENTED') {
    throw new Error('FAIL: code is not NOT_IMPLEMENTED');
  }

  console.log('\n--- 6. Testing ToolDispatcher - Registered Handler Execution ---');
  dispatcher.registerHandler('get_course_schedule', async (args, auth) => {
    return [{ courseCode: 'BIL481', day: args.day, studentId: auth.studentId }];
  });
  const registeredResult = await dispatcher.dispatch('get_course_schedule', { day: 'MONDAY' }, studentAuth);
  console.log('Registered execution result:', JSON.stringify(registeredResult));
  if (registeredResult.isError) {
    throw new Error('FAIL: registered handler execution returned an error');
  }

  console.log('\n--- 7. Testing AgentOrchestrator Skeleton ---');
  const agent = new AgentOrchestrator(dispatcher);
  try {
    await agent.executePlan('What is for lunch?', studentAuth);
    throw new Error('FAIL: agent did not throw NOT_IMPLEMENTED');
  } catch (err) {
    console.log('Agent skeleton threw as expected:', err.message);
    if (!err.message.includes('NOT_IMPLEMENTED')) {
      throw new Error('FAIL: agent error does not contain NOT_IMPLEMENTED');
    }
  }

  console.log('\n>>> ALL 7 TEST CASES PASSED PERFECTLY! <<<');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
