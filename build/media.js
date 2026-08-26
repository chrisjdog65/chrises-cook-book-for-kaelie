/* Kaelie's Recipe Book — real recipe media layer
   Uses each recipe's existing photoQuery/videoQuery. Photos are fetched from
   Flickr's public photo service; video buttons open the matching YouTube search.
   No recipe text or data is changed. */
(function () {
  'use strict';
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>\"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function mediaUrl(q) {
    return 'https://loremflickr.com/1200/800/' + encodeURIComponent(String(q || '').replace(/\s+/g, ','));
  }
  function videoUrl(q) {
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(String(q || '') + ' recipe cooking');
  }
  function enhance(d) {
    if (!d || d.getAttribute('data-media-enhanced')) return;
    var title = d.querySelector('.recsum .t');
    if (!title) return;
    var name = title.textContent.trim();
    var photo = d.getAttribute('data-photo-query') || name;
    var video = d.getAttribute('data-video-query') || name;
    var old = d.querySelector('.recipe-media');
    if (old) return;
    var box = document.createElement('div');
    box.className = 'recipe-media';
    box.innerHTML = '<div class="recipe-media-photo"><img loading="lazy" alt="Real photo example of ' + esc(name) + '" src="' + esc(mediaUrl(photo)) + '"><span>Photo example</span></div>' +
      '<a class="recipe-media-video" target="_blank" rel="noopener noreferrer" href="' + esc(videoUrl(video)) + '">▶ Watch real cooking videos for ' + esc(name) + '</a>';
    var body = d.querySelector('.recbody') || d;
    body.insertBefore(box, body.firstChild);
    d.setAttribute('data-media-enhanced', '1');
  }
  function scan() {
    document.querySelectorAll('.rec').forEach(enhance);
  }
  function start() {
    scan();
    new MutationObserver(scan).observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
