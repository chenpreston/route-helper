var map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([-37.683333, 176.166667], 12);
  
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | <a href="https://www.baybus.co.nz/help-and-contact/general-transit-feed-specification/" target="_blank" rel="noopener noreferrer">Baybus.</a> CC BY 4.0'
  }).addTo(map);
  
  var routeLayer;
  var stopsLayer;
  var animationLayer;
  var playheadMarker;
  var allStops;
  var allRoutes;
  var coords = [];
  var animationFrameId;
  var isPlaying = false;
  var currentIndex = 0;
  
  // 播放速度控制
  const speedLevels = [
    { label: '1', delay: 200 },
    { label: '2', delay: 100 },
    { label: '3', delay: 50 }
  ];
  var currentSpeedIndex = 1; // 默认正常速度
  var playSpeed = speedLevels[currentSpeedIndex].delay;
  
  // 自定义站点图标
  const stopIcon = L.icon({
    iconUrl: './images/busstop.svg',
    iconSize: [25, 25],
    iconAnchor: [12.5, 25],
    popupAnchor: [0, -25]
  });
  
  // 自定义播放头图标（圆点）
  const playheadIcon = L.icon({
    iconUrl: './images/bus.svg',
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5]
  });
  
  fetch('tauranga.geojson')
    .then(response => {
      if (!response.ok) throw new Error('路线文件加载失败');
      return response.json();
    })
    .then(data => {
      allRoutes = data.features;
     
  
      var urbanList = document.getElementById('route-list-urban');
        var schoolList = document.getElementById('route-list-school');
  
      // 填充城市公交列表
      allRoutes.forEach(feature => {
        if (feature.properties.shape_id.startsWith('24')) {
          var li = document.createElement('li');
          li.textContent = `${feature.properties.route_short_name} ${feature.properties.route_long_name} [${feature.properties.shape_id}]`;
          li.dataset.shapeId = feature.properties.shape_id;
          urbanList.appendChild(li);
        }
      });

      // 填充学校公交列表
      allRoutes.forEach(feature => {
        if (feature.properties.shape_id.startsWith('1')) {
          var li = document.createElement('li');
          li.textContent = `${feature.properties.route_short_name} ${feature.properties.route_long_name} [${feature.properties.shape_id}]`;
          li.dataset.shapeId = feature.properties.shape_id;
          schoolList.appendChild(li);
        }
      });
  
      return fetch('stops.geojson')
      .then(response => {
        if (!response.ok) throw new Error('站点文件加载失败');
        return response.json();
      })
      .then(stopsData => {
        allStops = stopsData.features;
        

        const urbanInput = document.getElementById('route-input-urban');
        const urbanList = document.getElementById('route-list-urban');
        const schoolInput = document.getElementById('route-input-school');
        const schoolList = document.getElementById('route-list-school');

        urbanInput.addEventListener('focus', () => {
          urbanList.style.display = 'block';
          filterOptions(urbanInput, urbanList);
        });
        urbanInput.addEventListener('input', () => filterOptions(urbanInput, urbanList));
        urbanList.addEventListener('click', (e) => selectOption(e, urbanInput, urbanList));

        schoolInput.addEventListener('focus', () => {
          schoolList.style.display = 'block';
          filterOptions(schoolInput, schoolList);
        });
        schoolInput.addEventListener('input', () => filterOptions(schoolInput, schoolList));
        schoolList.addEventListener('click', (e) => selectOption(e, schoolInput, schoolList));

        document.addEventListener('click', (e) => {
          if (!urbanInput.contains(e.target) && !urbanList.contains(e.target)) {
            urbanList.style.display = 'none';
          }
          if (!schoolInput.contains(e.target) && !schoolList.contains(e.target)) {
            schoolList.style.display = 'none';
          }
        });

        function filterOptions(input, list) {
          const searchText = input.value.toLowerCase();
          const options = list.getElementsByTagName('li');
          Array.from(options).forEach(option => {
            const optionText = option.textContent.toLowerCase();
            if (optionText.includes(searchText)) {
              option.style.display = 'block';
            } else {
              option.style.display = 'none';
            }
          });
        }

        function selectOption(e, input, list) {
          if (e.target.tagName === 'LI') {
            input.value = e.target.textContent;
            list.style.display = 'none';
            const selectedShapeId = e.target.dataset.shapeId;
            showSelectedRoute(selectedShapeId);
          }
        }

        function showSelectedRoute(selectedShapeId) {
          if (routeLayer) map.removeLayer(routeLayer);
          if (stopsLayer) map.removeLayer(stopsLayer);
          if (animationLayer) map.removeLayer(animationLayer);
          if (playheadMarker) map.removeLayer(playheadMarker);
          stopAnimation();
          coords = [];
          currentIndex = 0;
          animationLayer = null;
          playheadMarker = null;

          if (selectedShapeId) {
            var selectedRoute = allRoutes.find(f => f.properties.shape_id === selectedShapeId);
            if (!selectedRoute) {
              console.error('未找到匹配的路线:', selectedShapeId);
              return;
            }
            

            routeLayer = L.geoJSON(selectedRoute, {
              style: {
                color: selectedRoute.properties.route_color || '#0066e3',
                weight: 10,
                opacity: 0.8
              },
              onEachFeature: function (feature, layer) {
                layer.bindPopup(`Line: ${feature.properties.route_short_name || feature.properties.route_id}`);
              }
            }).addTo(map);

            stopsLayer = L.geoJSON(allStops, {
              filter: function(feature) {
                const stopRoutes = feature.properties.routes || [];
                return stopRoutes.some(route => route.route_id === selectedRoute.properties.route_id);
              },
              pointToLayer: function(feature, latlng) {
                return L.marker(latlng, { icon: stopIcon });
              },
              onEachFeature: function(feature, layer) {
                layer.bindPopup(`
                  <b>Stop name:</b> ${feature.properties.stop_name || '未知'}<br>
                  <b>Stop ID:</b> ${feature.properties.stop_id || '未知'}<br>
                  <b>Lines:</b> ${feature.properties.routes.map(r => r.route_short_name).join(', ')}
                `);
              }
            }).addTo(map);

            const routeBounds = routeLayer.getBounds();
            if (stopsLayer.getBounds().isValid()) {
              routeBounds.extend(stopsLayer.getBounds());
            }
            map.fitBounds(routeBounds);

            if (selectedRoute.geometry && selectedRoute.geometry.coordinates) {
              let rawCoords = selectedRoute.geometry.coordinates;
              if (selectedRoute.geometry.type === 'MultiLineString') {
                coords = rawCoords.flat(1).map(coord => [coord[1], coord[0]]).filter(coord => Array.isArray(coord) && coord.length === 2);
              } else if (selectedRoute.geometry.type === 'LineString') {
                coords = rawCoords.map(coord => [coord[1], coord[0]]).filter(coord => Array.isArray(coord) && coord.length === 2);
              } else {
                console.error('不支持的几何类型:', selectedRoute.geometry.type);
                return;
              }

              if (coords.length > 0) {
                document.getElementById('progress').max = coords.length - 1;
                document.getElementById('progress').value = 0;
              } else {
                console.error('没有有效的坐标数据:', selectedRoute);
              }
            } else {
              console.error('路线缺少坐标数据:', selectedRoute);
            }
          }
        }
      });
  })
  .catch(error => console.error('加载失败:', error));

function clearMapForAnimation() {
  if (routeLayer) map.removeLayer(routeLayer);
  if (stopsLayer) map.removeLayer(stopsLayer);
  if (animationLayer) map.removeLayer(animationLayer);
  if (playheadMarker) map.removeLayer(playheadMarker);
  animationLayer = L.polyline([], { color: 'red', weight: 5, opacity: 0.9 }).addTo(map);
  playheadMarker = L.marker(coords[0] || [0, 0], { icon: playheadIcon }).addTo(map);
  currentIndex = 0;
  document.getElementById('progress').value = 0;
}

function animateRoute() {
  if (isPlaying && coords && coords.length > 0 && currentIndex < coords.length) {
    const currentCoord = coords[currentIndex];
    if (currentCoord && Array.isArray(currentCoord) && currentCoord.length === 2) {
      animationLayer.addLatLng(currentCoord);
      playheadMarker.setLatLng(currentCoord);
      map.panTo(currentCoord);
      document.getElementById('progress').value = currentIndex;
      currentIndex++;
      animationFrameId = setTimeout(animateRoute, playSpeed);
    } else {
      console.error('无效的坐标点:', currentCoord, '在索引:', currentIndex);
      stopAnimation();
    }
  } else if (currentIndex >= coords.length) {
    stopAnimation();
  }
}

function stopAnimation() {
  isPlaying = false;
  if (animationFrameId) clearTimeout(animationFrameId);
}

function updateAnimationPosition(index) {
  currentIndex = Math.max(0, Math.min(index, coords.length - 1));
  animationLayer.setLatLngs(coords.slice(0, currentIndex + 1));
  playheadMarker.setLatLng(coords[currentIndex]);
  map.panTo(coords[currentIndex]);
  document.getElementById('progress').value = currentIndex;
}

document.getElementById('play').addEventListener('click', () => {
  if (coords && coords.length > 0) {
    if (!animationLayer || !playheadMarker) {
      clearMapForAnimation();
    }
    isPlaying = true;
    animateRoute();
  } else {
    console.error('无法播放动画: coords 未准备好', { coords });
  }
});

document.getElementById('pause').addEventListener('click', () => {
  stopAnimation();
});

document.getElementById('forward').addEventListener('click', () => {
  stopAnimation();
  if (coords && animationLayer && currentIndex < coords.length) {
    const step = Math.min(currentIndex + 5, coords.length - 1);
    updateAnimationPosition(step);
  }
});

document.getElementById('backward').addEventListener('click', () => {
  stopAnimation();
  if (coords && animationLayer) {
    const step = Math.max(currentIndex - 5, 0);
    updateAnimationPosition(step);
  }
});

document.getElementById('progress').addEventListener('input', (e) => {
  stopAnimation();
  if (coords && animationLayer) {
    const newIndex = parseInt(e.target.value, 10);
    updateAnimationPosition(newIndex);
  }
});

document.getElementById('X').addEventListener('click', () => {
  currentSpeedIndex = (currentSpeedIndex + 1) % speedLevels.length;
  playSpeed = speedLevels[currentSpeedIndex].delay;
  document.getElementById('X').querySelector('img').src = `./images/${speedLevels[currentSpeedIndex].label}.svg`;
});

document.getElementById('replay').addEventListener('click', () => {
  if (coords && coords.length > 0) {
    stopAnimation();
    clearMapForAnimation();
    isPlaying = true;
    animateRoute();
  } else {
    console.error('无法重放动画: coords 未准备好', { coords });
  }
});