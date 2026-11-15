import http from 'node:http';
import {
  startHttpServer,
  ToolDispatcher,
  sampleCafeteriaHandler,
  sampleLibraryHandler,
  sampleShuttleHandler,
  sampleCourseScheduleHandler,
  registerSampleMockHandlers,
} from '../dist/index.js';

async function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (c) => (resBody += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody) });
          } catch {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let resBody = '';
      res.on('data', (c) => (resBody += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    }).on('error', reject);
  });
}

async function runVerification() {
  console.log('=== Step 1: Testing Sample Mock Handlers Direct Logic ===');

  // Test cafeteria weekday vs weekend
  const weekdayMenu = await sampleCafeteriaHandler({ date: '2026-11-16' }, { role: 'GUEST' }); // 2026-11-16 is Monday
  console.log('Weekday Menu available:', weekdayMenu.available, '| lunch soup:', weekdayMenu.lunch?.soup);
  if (!weekdayMenu.available || !weekdayMenu.lunch) {
    throw new Error('FAIL: Weekday menu should be available with lunch');
  }

  const weekendMenu = await sampleCafeteriaHandler({ date: '2026-11-15' }, { role: 'GUEST' }); // 2026-11-15 is Sunday
  console.log('Weekend Menu available:', weekendMenu.available, '| reason:', weekendMenu.unavailableReason);
  if (weekendMenu.available || !weekendMenu.unavailableReason) {
    throw new Error('FAIL: Weekend menu should not be available and have unavailableReason');
  }

  // Test library occupancy mock (FR-05)
  const libraryReport = await sampleLibraryHandler({}, { role: 'GUEST' });
  console.log('Library report isSimulated:', libraryReport.isSimulated, '| totalCapacity:', libraryReport.totalCapacity, '| totalOccupied:', libraryReport.totalOccupied);
  if (!libraryReport.isSimulated) {
    throw new Error('FAIL: Library report must have isSimulated: true');
  }
  if (libraryReport.floors.length === 0) {
    throw new Error('FAIL: Library floors should not be empty');
  }

  // Test shuttle mock (FR-04)
  const shuttleData = await sampleShuttleHandler({ route: 'MAIN_RING' }, { role: 'GUEST' });
  console.log('Shuttle routeId:', shuttleData.routeId, '| nextDepartures:', shuttleData.nextDepartures.join(', '));
  if (shuttleData.nextDepartures.length === 0) {
    throw new Error('FAIL: Shuttle departures empty');
  }

  // Test course schedule mock (FR-06)
  const courseSchedule = await sampleCourseScheduleHandler({ day: 'MONDAY' }, { role: 'STUDENT', studentId: '241101013' });
  console.log('Course entries count:', courseSchedule.length, '| first course:', courseSchedule[0]?.courseCode);
  if (courseSchedule.length === 0) {
    throw new Error('FAIL: Course schedule empty');
  }

  console.log('\n=== Step 2: Testing Streamable HTTP & Endpoints (/health, /mcp) ===');
  const testPort = 3198;
  const dispatcher = new ToolDispatcher();
  registerSampleMockHandlers(dispatcher);

  const server = await startHttpServer(testPort, '127.0.0.1', dispatcher);
  const baseUrl = `http://127.0.0.1:${testPort}`;

  try {
    // 1. GET /health
    const health = await getJson(`${baseUrl}/health`);
    console.log('GET /health status:', health.status, '| body:', JSON.stringify(health.data));
    if (health.status !== 200 || health.data.status !== 'ok') {
      throw new Error('FAIL: Health check failed');
    }

    // 2. POST /mcp tools/list
    const toolsList = await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    console.log('POST /mcp tools/list status:', toolsList.status, '| count:', toolsList.data.result.tools.length);
    if (toolsList.data.result.tools.length !== 4) {
      throw new Error('FAIL: Expected 4 tools in tools/list');
    }

    // 3. POST /mcp tools/call get_cafeteria_menu (weekday)
    const cafeteriaCall = await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_cafeteria_menu',
        arguments: { date: '2026-11-18' }, // Wednesday
      },
    });
    console.log('POST /mcp get_cafeteria_menu status:', cafeteriaCall.status, '| result available:', cafeteriaCall.data.result.content[0].data.available);
    if (!cafeteriaCall.data.result.content[0].data.available) {
      throw new Error('FAIL: Weekday menu call failed');
    }

    // 4. POST /mcp tools/call get_library_occupancy
    const libraryCall = await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_library_occupancy',
        arguments: { floor: 'FLOOR_2' },
      },
    });
    console.log('POST /mcp get_library_occupancy isSimulated:', libraryCall.data.result.content[0].data.isSimulated);
    if (!libraryCall.data.result.content[0].data.isSimulated) {
      throw new Error('FAIL: Library occupancy call failed');
    }

    // 5. POST /mcp tools/call get_course_schedule with auth header
    const authCourseCall = await postJson(
      `${baseUrl}/mcp`,
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_course_schedule',
          arguments: { day: 'TODAY' },
        },
      },
      {
        'X-Authenticated-Student-Id': '241101013',
        'X-Authenticated-User-Role': 'STUDENT',
      }
    );
    console.log('POST /mcp authenticated course schedule status:', authCourseCall.status, '| courses returned:', authCourseCall.data.result.content[0].data.length);
    if (authCourseCall.data.result.content[0].data.length === 0) {
      throw new Error('FAIL: Authenticated course schedule returned 0 courses');
    }

    // 6. POST /mcp tools/call get_course_schedule WITHOUT auth header -> expect 401 Unauthorized
    const unauthCourseCall = await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'get_course_schedule',
        arguments: { day: 'TODAY' },
      },
    });
    console.log('POST /mcp unauthenticated course schedule status:', unauthCourseCall.status, '| error:', unauthCourseCall.data.error.message);
    if (unauthCourseCall.status !== 401) {
      throw new Error(`FAIL: Expected status 401, got ${unauthCourseCall.status}`);
    }

    console.log('\n>>> ALL ENDPOINT & MOCK VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
